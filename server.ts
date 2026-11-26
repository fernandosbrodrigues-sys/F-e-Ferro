import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { getActiveStore, type IronLogStore } from './server/store.ts';
import type { UserProfile, UserRole } from './src/types.ts';

const PORT =
  process.env.NODE_ENV === 'development' ? 3000 : Number(process.env.PORT) || 3000;
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

async function bootstrapEnvAdmin() {
  const adminUser = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  const adminPass = process.env.ADMIN_PASSWORD || '';
  if (!adminUser || !adminPass) return;
  if (!USERNAME_RE.test(adminUser) || adminPass.length < 6) return;

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
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

function isHttpsRequest(req: Request): boolean {
  return (
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    (process.env.APP_URL || '').startsWith('https://') ||
    (req.headers.origin || '').startsWith('https://')
  );
}

function setSessionCookie(req: Request, res: Response, token: string) {
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
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(req: Request, res: Response) {
  const isHttps = isHttpsRequest(req);
  const attrs = [`${SESSION_COOKIE}=`, 'HttpOnly', 'Path=/', 'Max-Age=0'];
  if (isHttps) {
    attrs.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    attrs.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', attrs.join('; '));
}

interface AuthedRequest extends Request {
  user?: UserProfile;
  sessionToken?: string;
  store?: IronLogStore;
}

function extractRequestToken(req: Request): string {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    const bearer = req.headers.authorization.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE] || '';
}

function asyncHandler(
  fn: (req: AuthedRequest, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

function requireCsrfHeader(req: Request, res: Response, next: NextFunction) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const xrw = req.headers['x-requested-with'];
    if (xrw !== 'IRONLOG') {
      res.status(403).json({ error: 'Cabeçalho de proteção ausente.' });
      return;
    }
  }
  next();
}

const requireAuth = asyncHandler(async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const { store } = await getActiveStore();
  req.store = store;
  const token = extractRequestToken(req);
  if (!token) {
    res.status(401).json({ error: 'Não autenticado ou conta bloqueada.' });
    return;
  }
  const resolved = await store.resolveSession(token);
  if (!resolved) {
    res.status(401).json({ error: 'Não autenticado ou conta bloqueada.' });
    return;
  }
  req.user = resolved.user;
  req.sessionToken = resolved.token;
  next();
});

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN' || req.user.is_blocked) {
    res.status(403).json({ error: 'Acesso restrito ao administrador.' });
    return;
  }
  next();
}

async function startServer() {
  await bootstrapEnvAdmin().catch((err) => {
    console.warn('Admin env bootstrap warning:', err instanceof Error ? err.message : err);
  });

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', requireCsrfHeader);

  // ===========================================================================
  // AUTH ROUTES
  // ===========================================================================
  app.get(
    '/api/bootstrap',
    asyncHandler(async (req, res) => {
      const { store } = await getActiveStore();
      const token = extractRequestToken(req);
      const resolved = token ? await store.resolveSession(token) : null;
      if (!resolved) {
        const adminCount = await store.countAdmins();
        res.json({
          hasAdmin: adminCount > 0,
          user: null,
          workouts: [],
          exercises: [],
          sessions: [],
          setLogs: [],
          weightLogs: [],
          activeSession: null,
        });
        return;
      }
      const payload = await store.buildUserBootstrap(resolved.user.id);
      res.json({ ...payload, sessionToken: resolved.token });
    })
  );

  app.post(
    '/api/auth/claim-admin',
    asyncHandler(async (req, res) => {
      const username = String(req.body?.username || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const confirmPassword = String(req.body?.confirmPassword || '');

      if (!USERNAME_RE.test(username)) {
        res.status(400).json({ error: 'Use 3–24 caracteres (a-z, 0-9, ., _, -).' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });
        return;
      }
      if (password !== confirmPassword) {
        res.status(400).json({ error: 'As senhas não coincidem.' });
        return;
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
        res.status(409).json({ error: 'A conta ADMIN inicial já foi configurada.' });
        return;
      }
      if (result === 'USERNAME_EXISTS') {
        res.status(409).json({ error: 'Nome de usuário já está em uso.' });
        return;
      }

      const token = crypto.randomBytes(32).toString('base64url');
      await store.createSession(token, userId, now);
      setSessionCookie(req, res, token);
      const payload = await store.buildUserBootstrap(userId);
      res.json({ ...payload, sessionToken: token });
    })
  );

  app.post(
    '/api/auth/register',
    asyncHandler(async (req, res) => {
      const username = String(req.body?.username || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const confirmPassword = String(req.body?.confirmPassword || '');

      if (!USERNAME_RE.test(username)) {
        res.status(400).json({ error: 'Use 3–24 caracteres (a-z, 0-9, ., _, -).' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });
        return;
      }
      if (password !== confirmPassword) {
        res.status(400).json({ error: 'As senhas não coincidem.' });
        return;
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
        res.status(409).json({ error: 'Nome de usuário já está em uso.' });
        return;
      }

      const token = crypto.randomBytes(32).toString('base64url');
      await store.createSession(token, userId, now);
      setSessionCookie(req, res, token);
      const payload = await store.buildUserBootstrap(userId);
      res.json({ ...payload, sessionToken: token });
    })
  );

  app.post(
    '/api/auth/login',
    asyncHandler(async (req, res) => {
      const username = String(req.body?.username || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (!USERNAME_RE.test(username) || !password) {
        res.status(400).json({ error: 'Informe usuário e senha válidos.' });
        return;
      }

      const { store } = await getActiveStore();
      const user = await store.getUserByUsername(username);

      if (!user || !verifyPassword(password, user.password_hash)) {
        res.status(401).json({ error: 'Usuário ou senha incorretos.' });
        return;
      }
      if (user.is_blocked) {
        res.status(403).json({ error: 'Conta bloqueada. Contate o administrador.' });
        return;
      }

      const token = crypto.randomBytes(32).toString('base64url');
      await store.createSession(token, user.id, Date.now());
      setSessionCookie(req, res, token);
      const payload = await store.buildUserBootstrap(user.id);
      res.json({ ...payload, sessionToken: token });
    })
  );

  app.post(
    '/api/auth/logout',
    asyncHandler(async (req, res) => {
      const { store } = await getActiveStore();
      const token = extractRequestToken(req);
      if (token) {
        await store.deleteSessionByToken(token);
      }
      clearSessionCookie(req, res);
      res.json({ ok: true });
    })
  );

  // ===========================================================================
  // WORKOUT & SESSION ROUTES (user-scoped)
  // ===========================================================================
  app.put(
    '/api/workouts/schedule',
    requireAuth,
    asyncHandler(async (req, res) => {
      const raw = req.body?.assignments;
      if (!Array.isArray(raw) || raw.length === 0) {
        res.status(400).json({ error: 'Escala inválida.' });
        return;
      }
      const assignments = raw.map((item: Record<string, unknown>) => ({
        workoutId: String(item?.workoutId || ''),
        dayOfWeek: Number(item?.dayOfWeek),
      }));
      const result = await req.store!.updateWorkoutSchedule(req.user!.id, assignments);
      if (result === 'INVALID') {
        res.status(400).json({ error: 'Escolha dias únicos válidos para todos os treinos.' });
        return;
      }
      res.json(result);
    })
  );

  app.post(
    '/api/sessions/start',
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = req.user!.id;
      const workoutId = String(req.body?.workoutId || '');
      const result = await req.store!.startWorkout(userId, workoutId);
      if (result === 'NOT_FOUND') {
        res.status(404).json({ error: 'Treino não encontrado.' });
        return;
      }
      res.json(result);
    })
  );

  app.get(
    '/api/sessions/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const detail = await req.store!.getSessionDetail(req.user!.id, String(req.params.id));
      if (!detail) {
        res.status(404).json({ error: 'Sessão não encontrada.' });
        return;
      }
      res.json(detail);
    })
  );

  app.post(
    '/api/sessions/:id/finish',
    requireAuth,
    asyncHandler(async (req, res) => {
      const result = await req.store!.finishSession(req.user!.id, String(req.params.id));
      if (result === 'NOT_FOUND') {
        res.status(404).json({ error: 'Sessão não encontrada.' });
        return;
      }
      res.json(result);
    })
  );

  app.delete(
    '/api/sessions/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const payload = await req.store!.discardSession(req.user!.id, String(req.params.id));
      res.json(payload);
    })
  );

  app.post(
    '/api/session-exercises/:id/substitute',
    requireAuth,
    asyncHandler(async (req, res) => {
      const key = String(req.body?.key || '').trim();
      const name = String(req.body?.name || '').trim();
      const defaultRestSec = Math.min(600, Math.max(10, Number(req.body?.default_rest_sec || 90)));
      const updateAllSets = Boolean(req.body?.updateAllSets);

      if (!key || !name) {
        res.status(400).json({ error: 'Variação inválida.' });
        return;
      }

      const result = await req.store!.substituteExercise(req.user!.id, String(req.params.id), {
        key,
        name,
        defaultRestSec,
        updateAllSets,
      });
      if (result === 'NOT_FOUND') {
        res.status(404).json({ error: 'Exercício não encontrado.' });
        return;
      }
      res.json(result);
    })
  );

  app.post(
    '/api/session-exercises/:id/sets',
    requireAuth,
    asyncHandler(async (req, res) => {
      const result = await req.store!.addSet(req.user!.id, String(req.params.id));
      if (result === 'NOT_FOUND') {
        res.status(404).json({ error: 'Exercício não encontrado.' });
        return;
      }
      res.json(result);
    })
  );

  app.patch(
    '/api/sets/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const updated = await req.store!.updateSet(
        req.user!.id,
        String(req.params.id),
        (req.body || {}) as Record<string, unknown>
      );
      if (!updated) {
        res.status(404).json({ error: 'Série não encontrada.' });
        return;
      }
      res.json({ set: updated });
    })
  );

  app.delete(
    '/api/sets/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const payload = await req.store!.deleteSet(req.user!.id, String(req.params.id));
      res.json(payload);
    })
  );

  // ===========================================================================
  // BODY WEIGHT ROUTES
  // ===========================================================================
  app.post(
    '/api/weights',
    requireAuth,
    asyncHandler(async (req, res) => {
      const weightKg = Number(req.body?.weight_kg);
      if (!Number.isFinite(weightKg) || weightKg <= 0) {
        res.status(400).json({ error: 'Informe um peso válido.' });
        return;
      }
      const payload = await req.store!.logWeight(req.user!.id, weightKg);
      res.json(payload);
    })
  );

  app.delete(
    '/api/weights/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const payload = await req.store!.deleteWeight(req.user!.id, String(req.params.id));
      res.json(payload);
    })
  );

  // ===========================================================================
  // ADMIN ROUTES (enforced server-side via requireAuth + requireAdmin)
  // ===========================================================================
  app.get(
    '/api/admin/users',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const users = await req.store!.listUsers();
      res.json({ users });
    })
  );

  app.post(
    '/api/admin/users',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const username = String(req.body?.username || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const role: UserRole = req.body?.role === 'ADMIN' ? 'ADMIN' : 'ALUNO';

      if (!USERNAME_RE.test(username)) {
        res.status(400).json({ error: 'Usuário inválido (3–24 caracteres: a-z, 0-9, ., _, -).' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });
        return;
      }

      const result = await req.store!.createUserWithWorkouts({
        id: crypto.randomUUID(),
        username,
        password_hash: hashPassword(password),
        role,
        created_at: Date.now(),
      });
      if (result === 'USERNAME_EXISTS') {
        res.status(409).json({ error: 'Nome de usuário já está em uso.' });
        return;
      }
      const users = await req.store!.listUsers();
      res.json({ users });
    })
  );

  app.patch(
    '/api/admin/users/:id/block',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const targetId = String(req.params.id);
      if (targetId === req.user!.id) {
        res.status(400).json({ error: 'Operação não permitida para a própria conta.' });
        return;
      }
      const blocked = Boolean(req.body?.blocked);
      const users = await req.store!.toggleBlockUser(targetId, blocked);
      res.json({ users });
    })
  );

  app.patch(
    '/api/admin/users/:id/password',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const targetId = String(req.params.id);
      const newPassword = String(req.body?.newPassword || '');
      const confirmPassword = String(req.body?.confirmPassword || '');
      if (newPassword.length < 6) {
        res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        res.status(400).json({ error: 'As senhas não coincidem.' });
        return;
      }
      await req.store!.resetUserPassword(targetId, hashPassword(newPassword));
      res.json({ ok: true });
    })
  );

  app.delete(
    '/api/admin/users/:id',
    requireAuth,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const targetId = String(req.params.id);
      if (targetId === req.user!.id) {
        res.status(400).json({ error: 'Não é possível excluir a própria conta.' });
        return;
      }
      const users = await req.store!.deleteUser(targetId);
      res.json({ users });
    })
  );

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Rota da API não encontrada.' });
  });

  app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
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
    res.status(status).json({
      error: err instanceof Error ? err.message : 'Erro interno do servidor.',
    });
  });

  // ===========================================================================
  // VITE / STATIC SERVING
  // ===========================================================================
  const distDir = path.resolve(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.join(distDir, 'index.html'));
  const useViteDev =
    process.env.NODE_ENV === 'development' ||
    (!hasDist && process.env.NODE_ENV !== 'production');

  if (useViteDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`IRON LOG running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
