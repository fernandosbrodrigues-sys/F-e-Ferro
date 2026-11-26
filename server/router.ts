import crypto from 'node:crypto';
import { getActiveStore, type IronLogStore } from './store.ts';
import type { UserProfile, UserRole } from '../src/types.ts';

const USERNAME_RE = /^[a-z0-9._-]{3,24}$/;
const SESSION_COOKIE = 'ironlog_session';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  try {
    const [salt, expectedHex] = parts;
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = crypto.scryptSync(password, salt, 64);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

let envBootstrapped = false;
async function ensureEnvAdmin() {
  if (envBootstrapped) return;
  envBootstrapped = true;

  const adminUser = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  const adminPass = process.env.ADMIN_PASSWORD || '';
  if (!adminUser || !adminPass) return;
  if (!USERNAME_RE.test(adminUser) || adminPass.length < 6) return;

  try {
    const { store } = await getActiveStore();
    const adminCount = await store.countAdmins();
    if (adminCount > 0) return;

    const existing = await store.getUserByUsername(adminUser);
    if (existing) return;

    await store.createUserWithWorkouts({
      id: crypto.randomUUID(),
      username: adminUser,
      password_hash: hashPassword(adminPass),
      role: 'ADMIN',
      created_at: Date.now(),
      claimSingleAdmin: true,
    });
  } catch (err) {
    console.warn('Admin env bootstrap warning:', err instanceof Error ? err.message : err);
  }
}

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      try {
        out[k] = decodeURIComponent(v);
      } catch {
        out[k] = v;
      }
    }
  }
  return out;
}

function isHttpsRequest(req: Request): boolean {
  return (
    req.url.startsWith('https://') ||
    req.headers.get('x-forwarded-proto') === 'https' ||
    (process.env.APP_URL || '').startsWith('https://') ||
    (process.env.URL || '').startsWith('https://') ||
    (req.headers.get('origin') || '').startsWith('https://')
  );
}

function buildSessionCookie(req: Request, token: string): string {
  const isHttps = isHttpsRequest(req);
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${30 * 24 * 3600}`,
  ];
  if (isHttps) {
    attrs.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    attrs.push('SameSite=Lax');
  }
  return attrs.join('; ');
}

function buildClearSessionCookie(req: Request): string {
  const isHttps = isHttpsRequest(req);
  const attrs = [`${SESSION_COOKIE}=`, 'HttpOnly', 'Path=/', 'Max-Age=0'];
  if (isHttps) {
    attrs.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    attrs.push('SameSite=Lax');
  }
  return attrs.join('; ');
}

function extractRequestToken(req: Request): string {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const bearer = auth.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookies = parseCookies(req.headers.get('cookie'));
  return cookies[SESSION_COOKIE] || '';
}

function jsonResponse(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      headers.set(k, v);
    }
  }
  return new Response(JSON.stringify(data), { status, headers });
}

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (!text.trim()) return {};
  if (text.length > 1024 * 1024) {
    const err = new Error('Corpo da requisição muito grande.') as Error & { status?: number };
    err.status = 413;
    throw err;
  }
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    const err = new Error('JSON inválido.') as Error & { status?: number };
    err.status = 400;
    throw err;
  }
}

async function requireAuth(
  req: Request
): Promise<{ user: UserProfile; token: string; store: IronLogStore } | Response> {
  const { store } = await getActiveStore();
  const token = extractRequestToken(req);
  if (!token) {
    return jsonResponse({ error: 'Não autenticado ou conta bloqueada.' }, 401);
  }
  const resolved = await store.resolveSession(token);
  if (!resolved) {
    return jsonResponse({ error: 'Não autenticado ou conta bloqueada.' }, 401);
  }
  return { user: resolved.user, token: resolved.token, store };
}

function requireAdmin(user: UserProfile): Response | null {
  if (user.role !== 'ADMIN' || user.is_blocked) {
    return jsonResponse({ error: 'Acesso restrito ao administrador.' }, 403);
  }
  return null;
}

function normalizeApiPath(rawPathname: string): string {
  if (rawPathname.startsWith('/.netlify/functions/api')) {
    const tail = rawPathname.slice('/.netlify/functions/api'.length);
    return `/api${tail.startsWith('/') ? tail : tail ? `/${tail}` : ''}`;
  }
  return rawPathname;
}

export async function handleApiRequest(req: Request): Promise<Response> {
  try {
    await ensureEnvAdmin();

    const method = req.method.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const xrw = req.headers.get('x-requested-with');
      if (xrw !== 'IRONLOG') {
        return jsonResponse({ error: 'Cabeçalho de proteção ausente.' }, 403);
      }
    }

    const url = new URL(req.url);
    const pathname = normalizeApiPath(url.pathname);

    if (method === 'GET' && pathname === '/api/health') {
      const { status } = await getActiveStore();
      return jsonResponse({ ok: true, backend: status.backend });
    }

    // =========================================================================
    // AUTH ROUTES
    // =========================================================================
    if (method === 'GET' && pathname === '/api/bootstrap') {
      const { store } = await getActiveStore();
      const token = extractRequestToken(req);
      const resolved = token ? await store.resolveSession(token) : null;
      if (!resolved) {
        const adminCount = await store.countAdmins();
        return jsonResponse({
          hasAdmin: adminCount > 0,
          user: null,
          workouts: [],
          exercises: [],
          sessions: [],
          setLogs: [],
          weightLogs: [],
          activeSession: null,
        });
      }
      const payload = await store.buildUserBootstrap(resolved.user.id);
      return jsonResponse({ ...payload, sessionToken: resolved.token });
    }

    if (method === 'POST' && pathname === '/api/auth/claim-admin') {
      const body = await readJsonBody(req);
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      const confirmPassword = String(body.confirmPassword || '');

      if (!USERNAME_RE.test(username)) {
        return jsonResponse({ error: 'Use 3–24 caracteres (a-z, 0-9, ., _, -).' }, 400);
      }
      if (password.length < 6) {
        return jsonResponse({ error: 'A senha deve ter no mínimo 6 caracteres.' }, 400);
      }
      if (password !== confirmPassword) {
        return jsonResponse({ error: 'As senhas não coincidem.' }, 400);
      }

      const { store } = await getActiveStore();
      const userId = crypto.randomUUID();
      const now = Date.now();
      const result = await store.createUserWithWorkouts({
        id: userId,
        username,
        password_hash: hashPassword(password),
        role: 'ADMIN',
        created_at: now,
        claimSingleAdmin: true,
      });

      if (result === 'ADMIN_EXISTS') {
        return jsonResponse({ error: 'A conta ADMIN inicial já foi configurada.' }, 409);
      }
      if (result === 'USERNAME_EXISTS') {
        return jsonResponse({ error: 'Nome de usuário já está em uso.' }, 409);
      }

      const token = crypto.randomBytes(32).toString('base64url');
      await store.createSession(token, userId, now);
      const payload = await store.buildUserBootstrap(userId);
      return jsonResponse({ ...payload, sessionToken: token }, 200, {
        'Set-Cookie': buildSessionCookie(req, token),
      });
    }

    if (method === 'POST' && pathname === '/api/auth/register') {
      const body = await readJsonBody(req);
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      const confirmPassword = String(body.confirmPassword || '');

      if (!USERNAME_RE.test(username)) {
        return jsonResponse({ error: 'Use 3–24 caracteres (a-z, 0-9, ., _, -).' }, 400);
      }
      if (password.length < 6) {
        return jsonResponse({ error: 'A senha deve ter no mínimo 6 caracteres.' }, 400);
      }
      if (password !== confirmPassword) {
        return jsonResponse({ error: 'As senhas não coincidem.' }, 400);
      }

      const { store } = await getActiveStore();
      const userId = crypto.randomUUID();
      const now = Date.now();
      const result = await store.createUserWithWorkouts({
        id: userId,
        username,
        password_hash: hashPassword(password),
        role: 'ALUNO',
        created_at: now,
      });

      if (result === 'USERNAME_EXISTS') {
        return jsonResponse({ error: 'Nome de usuário já está em uso.' }, 409);
      }

      const token = crypto.randomBytes(32).toString('base64url');
      await store.createSession(token, userId, now);
      const payload = await store.buildUserBootstrap(userId);
      return jsonResponse({ ...payload, sessionToken: token }, 200, {
        'Set-Cookie': buildSessionCookie(req, token),
      });
    }

    if (method === 'POST' && pathname === '/api/auth/login') {
      const body = await readJsonBody(req);
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!USERNAME_RE.test(username) || !password) {
        return jsonResponse({ error: 'Informe usuário e senha válidos.' }, 400);
      }

      const { store } = await getActiveStore();
      const user = await store.getUserByUsername(username);

      if (!user || !verifyPassword(password, user.password_hash)) {
        return jsonResponse({ error: 'Usuário ou senha incorretos.' }, 401);
      }
      if (user.is_blocked) {
        return jsonResponse({ error: 'Conta bloqueada. Contate o administrador.' }, 403);
      }

      const token = crypto.randomBytes(32).toString('base64url');
      await store.createSession(token, user.id, Date.now());
      const payload = await store.buildUserBootstrap(user.id);
      return jsonResponse({ ...payload, sessionToken: token }, 200, {
        'Set-Cookie': buildSessionCookie(req, token),
      });
    }

    if (method === 'POST' && pathname === '/api/auth/logout') {
      const { store } = await getActiveStore();
      const token = extractRequestToken(req);
      if (token) {
        await store.deleteSessionByToken(token);
      }
      return jsonResponse({ ok: true }, 200, {
        'Set-Cookie': buildClearSessionCookie(req),
      });
    }

    // =========================================================================
    // WORKOUT & SESSION ROUTES (user-scoped)
    // =========================================================================
    if (method === 'PUT' && pathname === '/api/workouts/schedule') {
      const auth = await requireAuth(req);
      if (auth instanceof Response) return auth;
      const body = await readJsonBody(req);
      const raw = body.assignments;
      if (!Array.isArray(raw) || raw.length === 0) {
        return jsonResponse({ error: 'Escala inválida.' }, 400);
      }
      const assignments = raw.map((item) => {
        const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        return {
          workoutId: String(rec.workoutId || ''),
          dayOfWeek: Number(rec.dayOfWeek),
        };
      });
      const result = await auth.store.updateWorkoutSchedule(auth.user.id, assignments);
      if (result === 'INVALID') {
        return jsonResponse({ error: 'Escolha dias únicos válidos para todos os treinos.' }, 400);
      }
      return jsonResponse(result);
    }

    if (method === 'POST' && pathname === '/api/sessions/start') {
      const auth = await requireAuth(req);
      if (auth instanceof Response) return auth;
      const body = await readJsonBody(req);
      const workoutId = String(body.workoutId || '');
      const result = await auth.store.startWorkout(auth.user.id, workoutId);
      if (result === 'NOT_FOUND') {
        return jsonResponse({ error: 'Treino não encontrado.' }, 404);
      }
      return jsonResponse(result);
    }

    const sessionFinishMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/finish$/);
    if (method === 'POST' && sessionFinishMatch) {
      const auth = await requireAuth(req);
      if (auth instanceof Response) return auth;
      const sessionId = decodeURIComponent(sessionFinishMatch[1]);
      const result = await auth.store.finishSession(auth.user.id, sessionId);
      if (result === 'NOT_FOUND') {
        return jsonResponse({ error: 'Sessão não encontrada.' }, 404);
      }
      return jsonResponse(result);
    }

    const sessionMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);
    if (sessionMatch) {
      const auth = await requireAuth(req);
      if (auth instanceof Response) return auth;
      const sessionId = decodeURIComponent(sessionMatch[1]);
      if (method === 'GET') {
        const detail = await auth.store.getSessionDetail(auth.user.id, sessionId);
        if (!detail) {
          return jsonResponse({ error: 'Sessão não encontrada.' }, 404);
        }
        return jsonResponse(detail);
      }
      if (method === 'DELETE') {
        const payload = await auth.store.discardSession(auth.user.id, sessionId);
        return jsonResponse(payload);
      }
    }

    const subMatch = pathname.match(/^\/api\/session-exercises\/([^/]+)\/substitute$/);
    if (method === 'POST' && subMatch) {
      const auth = await requireAuth(req);
      if (auth instanceof Response) return auth;
      const seId = decodeURIComponent(subMatch[1]);
      const body = await readJsonBody(req);
      const key = String(body.key || '').trim();
      const name = String(body.name || '').trim();
      const defaultRestSec = Math.min(600, Math.max(10, Number(body.default_rest_sec || 90)));
      const updateAllSets = Boolean(body.updateAllSets);
      if (!key || !name) {
        return jsonResponse({ error: 'Variação inválida.' }, 400);
      }
      const result = await auth.store.substituteExercise(auth.user.id, seId, {
        key,
        name,
        defaultRestSec,
        updateAllSets,
      });
      if (result === 'NOT_FOUND') {
        return jsonResponse({ error: 'Exercício não encontrado.' }, 404);
      }
      return jsonResponse(result);
    }

    const addSetMatch = pathname.match(/^\/api\/session-exercises\/([^/]+)\/sets$/);
    if (method === 'POST' && addSetMatch) {
      const auth = await requireAuth(req);
      if (auth instanceof Response) return auth;
      const seId = decodeURIComponent(addSetMatch[1]);
      const result = await auth.store.addSet(auth.user.id, seId);
      if (result === 'NOT_FOUND') {
        return jsonResponse({ error: 'Exercício não encontrado.' }, 404);
      }
      return jsonResponse(result);
    }

    const setMatch = pathname.match(/^\/api\/sets\/([^/]+)$/);
    if (setMatch) {
      const auth = await requireAuth(req);
      if (auth instanceof Response) return auth;
      const setId = decodeURIComponent(setMatch[1]);
      if (method === 'PATCH') {
        const body = await readJsonBody(req);
        const updated = await auth.store.updateSet(auth.user.id, setId, body);
        if (!updated) {
          return jsonResponse({ error: 'Série não encontrada.' }, 404);
        }
        return jsonResponse({ set: updated });
      }
      if (method === 'DELETE') {
        const payload = await auth.store.deleteSet(auth.user.id, setId);
        return jsonResponse(payload);
      }
    }

    // =========================================================================
    // BODY WEIGHT ROUTES
    // =========================================================================
    if (method === 'POST' && pathname === '/api/weights') {
      const auth = await requireAuth(req);
      if (auth instanceof Response) return auth;
      const body = await readJsonBody(req);
      const weightKg = Number(body.weight_kg);
      if (!Number.isFinite(weightKg) || weightKg <= 0) {
        return jsonResponse({ error: 'Informe um peso válido.' }, 400);
      }
      const payload = await auth.store.logWeight(auth.user.id, weightKg);
      return jsonResponse(payload);
    }

    const weightMatch = pathname.match(/^\/api\/weights\/([^/]+)$/);
    if (method === 'DELETE' && weightMatch) {
      const auth = await requireAuth(req);
      if (auth instanceof Response) return auth;
      const payload = await auth.store.deleteWeight(auth.user.id, decodeURIComponent(weightMatch[1]));
      return jsonResponse(payload);
    }

    // =========================================================================
    // ADMIN ROUTES (enforced server-side via requireAuth + requireAdmin)
    // =========================================================================
    if (pathname === '/api/admin/users') {
      const auth = await requireAuth(req);
      if (auth instanceof Response) return auth;
      const forbidden = requireAdmin(auth.user);
      if (forbidden) return forbidden;

      if (method === 'GET') {
        const users = await auth.store.listUsers();
        return jsonResponse({ users });
      }
      if (method === 'POST') {
        const body = await readJsonBody(req);
        const username = String(body.username || '').trim().toLowerCase();
        const password = String(body.password || '');
        const role: UserRole = body.role === 'ADMIN' ? 'ADMIN' : 'ALUNO';

        if (!USERNAME_RE.test(username)) {
          return jsonResponse({ error: 'Usuário inválido (3–24 caracteres: a-z, 0-9, ., _, -).' }, 400);
        }
        if (password.length < 6) {
          return jsonResponse({ error: 'A senha deve ter no mínimo 6 caracteres.' }, 400);
        }

        const result = await auth.store.createUserWithWorkouts({
          id: crypto.randomUUID(),
          username,
          password_hash: hashPassword(password),
          role,
          created_at: Date.now(),
        });
        if (result === 'USERNAME_EXISTS') {
          return jsonResponse({ error: 'Nome de usuário já está em uso.' }, 409);
        }
        const users = await auth.store.listUsers();
        return jsonResponse({ users });
      }
    }

    const adminBlockMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/block$/);
    if (method === 'PATCH' && adminBlockMatch) {
      const auth = await requireAuth(req);
      if (auth instanceof Response) return auth;
      const forbidden = requireAdmin(auth.user);
      if (forbidden) return forbidden;

      const targetId = decodeURIComponent(adminBlockMatch[1]);
      if (targetId === auth.user.id) {
        return jsonResponse({ error: 'Operação não permitida para a própria conta.' }, 400);
      }
      const body = await readJsonBody(req);
      const blocked = Boolean(body.blocked);
      const users = await auth.store.toggleBlockUser(targetId, blocked);
      return jsonResponse({ users });
    }

    const adminPasswordMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/password$/);
    if (method === 'PATCH' && adminPasswordMatch) {
      const auth = await requireAuth(req);
      if (auth instanceof Response) return auth;
      const forbidden = requireAdmin(auth.user);
      if (forbidden) return forbidden;

      const targetId = decodeURIComponent(adminPasswordMatch[1]);
      const body = await readJsonBody(req);
      const newPassword = String(body.newPassword || '');
      const confirmPassword = String(body.confirmPassword || '');
      if (newPassword.length < 6) {
        return jsonResponse({ error: 'Senha deve ter no mínimo 6 caracteres.' }, 400);
      }
      if (newPassword !== confirmPassword) {
        return jsonResponse({ error: 'As senhas não coincidem.' }, 400);
      }
      await auth.store.resetUserPassword(targetId, hashPassword(newPassword));
      return jsonResponse({ ok: true });
    }

    const adminDeleteMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (method === 'DELETE' && adminDeleteMatch) {
      const auth = await requireAuth(req);
      if (auth instanceof Response) return auth;
      const forbidden = requireAdmin(auth.user);
      if (forbidden) return forbidden;

      const targetId = decodeURIComponent(adminDeleteMatch[1]);
      if (targetId === auth.user.id) {
        return jsonResponse({ error: 'Não é possível excluir a própria conta.' }, 400);
      }
      const users = await auth.store.deleteUser(targetId);
      return jsonResponse({ users });
    }

    return jsonResponse({ error: 'Rota da API não encontrada.' }, 404);
  } catch (err) {
    console.error('API Error:', err);
    const status =
      err &&
      typeof err === 'object' &&
      'status' in err &&
      typeof (err as { status: unknown }).status === 'number' &&
      (err as { status: number }).status >= 400 &&
      (err as { status: number }).status < 600
        ? (err as { status: number }).status
        : 500;
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Erro interno do servidor.' },
      status
    );
  }
}
