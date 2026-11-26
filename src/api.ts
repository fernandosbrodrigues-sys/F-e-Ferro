import type {
  ActiveSessionPayload,
  BootstrapPayload,
  SetLog,
  SetLogPatch,
  UserProfile,
  UserRole,
} from './types.ts';

let memorySessionToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

export function clearMemorySessionToken() {
  memorySessionToken = null;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('X-Requested-With', 'IRONLOG');
  if (memorySessionToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${memorySessionToken}`);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new Error('Sem conexão com o servidor. Tente novamente.');
  }

  const contentType = res.headers.get('content-type') || '';
  const data = await res.json().catch(() => null);
  if (res.status === 401 && url !== '/api/auth/login') {
    memorySessionToken = null;
    unauthorizedHandler?.();
  }
  if (!res.ok) {
    const errMsg =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Erro na requisição (${res.status}).`;
    throw new Error(errMsg);
  }
  if (!contentType.includes('application/json') || !data || typeof data !== 'object') {
    throw new Error('Resposta inválida do servidor.');
  }
  if ('sessionToken' in data && typeof data.sessionToken === 'string') {
    memorySessionToken = data.sessionToken;
  }
  return data as T;
}

export const api = {
  bootstrap: () => request<BootstrapPayload>('/api/bootstrap'),

  claimAdmin: (username: string, password: string, confirmPassword: string) =>
    request<BootstrapPayload>('/api/auth/claim-admin', {
      method: 'POST',
      body: JSON.stringify({ username, password, confirmPassword }),
    }),

  register: (username: string, password: string, confirmPassword: string) =>
    request<BootstrapPayload>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, confirmPassword }),
    }),

  login: (username: string, password: string) =>
    request<BootstrapPayload>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: async () => {
    try {
      return await request<{ ok: boolean }>('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      memorySessionToken = null;
    }
  },

  updateWorkoutSchedule: (assignments: Array<{ workoutId: string; dayOfWeek: number }>) =>
    request<BootstrapPayload>('/api/workouts/schedule', {
      method: 'PUT',
      body: JSON.stringify({ assignments }),
    }),

  startWorkout: (workoutId: string) =>
    request<BootstrapPayload>('/api/sessions/start', {
      method: 'POST',
      body: JSON.stringify({ workoutId }),
    }),

  getSessionDetail: (sessionId: string) =>
    request<ActiveSessionPayload>(`/api/sessions/${encodeURIComponent(sessionId)}`),

  finishSession: (sessionId: string) =>
    request<BootstrapPayload>(`/api/sessions/${encodeURIComponent(sessionId)}/finish`, {
      method: 'POST',
    }),

  discardSession: (sessionId: string) =>
    request<BootstrapPayload>(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    }),

  substituteExercise: (
    sessionExerciseId: string,
    payload: { key: string; name: string; default_rest_sec: number; updateAllSets?: boolean }
  ) =>
    request<BootstrapPayload>(
      `/api/session-exercises/${encodeURIComponent(sessionExerciseId)}/substitute`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  addSet: (sessionExerciseId: string) =>
    request<BootstrapPayload>(
      `/api/session-exercises/${encodeURIComponent(sessionExerciseId)}/sets`,
      { method: 'POST' }
    ),

  updateSet: (setId: string, patch: SetLogPatch) =>
    request<{ set: SetLog }>(`/api/sets/${encodeURIComponent(setId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteSet: (setId: string) =>
    request<BootstrapPayload>(`/api/sets/${encodeURIComponent(setId)}`, {
      method: 'DELETE',
    }),

  logWeight: (weight_kg: number) =>
    request<BootstrapPayload>('/api/weights', {
      method: 'POST',
      body: JSON.stringify({ weight_kg }),
    }),

  deleteWeight: (id: string) =>
    request<BootstrapPayload>(`/api/weights/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  adminListUsers: () => request<{ users: UserProfile[] }>('/api/admin/users'),

  adminCreateUser: (username: string, password: string, role: UserRole) =>
    request<{ users: UserProfile[] }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, role }),
    }),

  adminToggleBlock: (userId: string, blocked: boolean) =>
    request<{ users: UserProfile[] }>(`/api/admin/users/${encodeURIComponent(userId)}/block`, {
      method: 'PATCH',
      body: JSON.stringify({ blocked }),
    }),

  adminResetPassword: (userId: string, newPassword: string, confirmPassword: string) =>
    request<{ ok: boolean }>(`/api/admin/users/${encodeURIComponent(userId)}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ newPassword, confirmPassword }),
    }),

  adminDeleteUser: (userId: string) =>
    request<{ users: UserProfile[] }>(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    }),
};
