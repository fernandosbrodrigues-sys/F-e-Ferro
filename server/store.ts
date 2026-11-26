import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DEFAULT_WORKOUT_SPLIT } from '../src/seedData.ts';
import type {
  ActiveSessionPayload,
  AlternativeOption,
  BootstrapPayload,
  Exercise,
  SessionExercise,
  SetLog,
  UserProfile,
  UserRole,
  WeightLog,
  Workout,
  WorkoutSession,
} from '../src/types.ts';

export interface UserAuthRecord extends UserProfile {
  password_hash: string;
}

export interface StorageStatus {
  backend: 'supabase' | 'sqlite';
  supabaseConfigured: boolean;
  supabaseReady: boolean;
  supabaseNeedsSchema: boolean;
}

export interface IronLogStore {
  countAdmins(): Promise<number>;
  getUserByUsername(username: string): Promise<UserAuthRecord | null>;
  getUserById(id: string): Promise<UserProfile | null>;
  resolveSession(token: string): Promise<{ user: UserProfile; token: string } | null>;
  createUserWithWorkouts(input: {
    id: string;
    username: string;
    password_hash: string;
    role: UserRole;
    created_at: number;
    claimSingleAdmin?: boolean;
  }): Promise<'OK' | 'USERNAME_EXISTS' | 'ADMIN_EXISTS'>;
  createSession(token: string, userId: string, createdAt: number): Promise<void>;
  deleteSessionByToken(token: string): Promise<void>;
  deleteSessionsByUser(userId: string): Promise<void>;
  buildUserBootstrap(userId: string): Promise<BootstrapPayload>;
  startWorkout(userId: string, workoutId: string): Promise<BootstrapPayload | 'NOT_FOUND'>;
  getSessionDetail(userId: string, sessionId: string): Promise<ActiveSessionPayload | null>;
  finishSession(userId: string, sessionId: string): Promise<BootstrapPayload | 'NOT_FOUND'>;
  discardSession(userId: string, sessionId: string): Promise<BootstrapPayload>;
  substituteExercise(
    userId: string,
    seId: string,
    opts: { key: string; name: string; defaultRestSec: number; updateAllSets: boolean }
  ): Promise<BootstrapPayload | 'NOT_FOUND'>;
  addSet(userId: string, seId: string): Promise<BootstrapPayload | 'NOT_FOUND'>;
  updateSet(userId: string, setId: string, body: Record<string, unknown>): Promise<SetLog | null>;
  deleteSet(userId: string, setId: string): Promise<BootstrapPayload>;
  logWeight(userId: string, weightKg: number): Promise<BootstrapPayload>;
  deleteWeight(userId: string, id: string): Promise<BootstrapPayload>;
  updateWorkoutSchedule(
    userId: string,
    assignments: Array<{ workoutId: string; dayOfWeek: number }>
  ): Promise<BootstrapPayload | 'INVALID'>;
  listUsers(): Promise<UserProfile[]>;
  toggleBlockUser(targetId: string, blocked: boolean): Promise<UserProfile[]>;
  resetUserPassword(targetId: string, passwordHash: string): Promise<void>;
  deleteUser(targetId: string): Promise<UserProfile[]>;
}

const DAY_UPPER_PT: Record<number, string> = {
  1: 'SEGUNDA',
  2: 'TERÇA',
  3: 'QUARTA',
  4: 'QUINTA',
  5: 'SEXTA',
  6: 'SÁBADO',
  7: 'DOMINGO',
};

function formatWorkoutNameForDay(code: string, dayOfWeek: number): string {
  const prefix = DAY_UPPER_PT[dayOfWeek] || 'TREINO';
  return `${prefix} – ${code.replace(/_/g, ' ')}`;
}

function parseAlternatives(raw: unknown): AlternativeOption[] {
  if (Array.isArray(raw)) return raw as AlternativeOption[];
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as AlternativeOption[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeSetPatch(current: SetLog, body: Record<string, unknown>) {
  const weightKg =
    'weight_kg' in body
      ? body.weight_kg === null || body.weight_kg === ''
        ? null
        : Math.max(0, Number(body.weight_kg))
      : current.weight_kg;
  const reps =
    'reps' in body
      ? body.reps === null || body.reps === ''
        ? null
        : Math.max(0, Math.round(Number(body.reps)))
      : current.reps;
  const rir =
    'rir' in body
      ? body.rir === null || body.rir === ''
        ? null
        : Math.min(5, Math.max(0, Math.round(Number(body.rir))))
      : current.rir;
  const plannedRestSec =
    'planned_rest_sec' in body && body.planned_rest_sec !== null && body.planned_rest_sec !== ''
      ? Math.min(600, Math.max(10, Math.round(Number(body.planned_rest_sec))))
      : current.planned_rest_sec;
  const actualRestSec =
    'actual_rest_sec' in body
      ? body.actual_rest_sec === null
        ? null
        : Math.max(0, Math.round(Number(body.actual_rest_sec)))
      : current.actual_rest_sec;
  const completed = 'completed' in body ? (body.completed ? 1 : 0) : current.completed;
  const completedAt = 'completed' in body ? (completed ? Date.now() : null) : current.completed_at;
  return {
    weight_kg: weightKg,
    reps,
    rir,
    planned_rest_sec: plannedRestSec,
    actual_rest_sec: actualRestSec,
    completed,
    completed_at: completedAt,
  };
}

// =============================================================================
// SQLITE STORE (Local / Fallback)
// =============================================================================
export class SqliteStore implements IronLogStore {
  private db: DatabaseSync;

  constructor(dbPath = path.resolve(process.cwd(), 'ironlog.db')) {
    try {
      this.db = new DatabaseSync(dbPath);
    } catch {
      const fallbackPath = path.join(os.tmpdir(), 'ironlog.db');
      this.db = new DatabaseSync(fallbackPath);
    }
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('ALUNO', 'ADMIN')),
        is_blocked INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workouts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        subtitle TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        UNIQUE (user_id, code)
      );

      CREATE TABLE IF NOT EXISTS exercises (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
        exercise_key TEXT NOT NULL,
        name TEXT NOT NULL,
        target_sets INTEGER NOT NULL,
        rep_min INTEGER NOT NULL,
        rep_max INTEGER NOT NULL,
        rest_min_sec INTEGER NOT NULL,
        rest_max_sec INTEGER NOT NULL,
        default_rest_sec INTEGER NOT NULL,
        is_compound INTEGER NOT NULL,
        alternatives_json TEXT NOT NULL,
        sort_order INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workout_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workout_id TEXT,
        workout_name TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
        total_volume_kg REAL NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS session_exercises (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
        workout_exercise_id TEXT,
        original_exercise_key TEXT NOT NULL,
        original_exercise_name TEXT NOT NULL,
        performed_exercise_key TEXT NOT NULL,
        performed_exercise_name TEXT NOT NULL,
        target_sets INTEGER NOT NULL,
        rep_min INTEGER NOT NULL,
        rep_max INTEGER NOT NULL,
        default_rest_sec INTEGER NOT NULL,
        alternatives_json TEXT NOT NULL,
        sort_order INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS set_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
        session_exercise_id TEXT NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
        exercise_key TEXT NOT NULL,
        exercise_name TEXT NOT NULL,
        set_number INTEGER NOT NULL,
        weight_kg REAL,
        reps INTEGER,
        rir INTEGER,
        planned_rest_sec INTEGER NOT NULL,
        actual_rest_sec INTEGER,
        completed INTEGER NOT NULL DEFAULT 0,
        completed_at INTEGER,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS weight_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        weight_kg REAL NOT NULL,
        recorded_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_workouts_user ON workouts(user_id);
      CREATE INDEX IF NOT EXISTS idx_exercises_workout ON exercises(workout_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON workout_sessions(user_id, status, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_session_ex ON session_exercises(session_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_set_logs_user_ex ON set_logs(user_id, exercise_key, created_at);
      CREATE INDEX IF NOT EXISTS idx_set_logs_sess_ex ON set_logs(session_exercise_id, set_number);
      CREATE INDEX IF NOT EXISTS idx_weight_logs_user ON weight_logs(user_id, recorded_at DESC);
    `);
  }

  private seedWorkoutsForUser(userId: string) {
    const existing = this.db.prepare('SELECT COUNT(*) AS cnt FROM workouts WHERE user_id = ?').get(userId) as {
      cnt: number;
    };
    if (existing.cnt > 0) return;

    const insWorkout = this.db.prepare(
      'INSERT INTO workouts (id, user_id, day_of_week, code, name, subtitle, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const insExercise = this.db.prepare(
      'INSERT INTO exercises (id, user_id, workout_id, exercise_key, name, target_sets, rep_min, rep_max, rest_min_sec, rest_max_sec, default_rest_sec, is_compound, alternatives_json, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    for (const wk of DEFAULT_WORKOUT_SPLIT) {
      const wkId = crypto.randomUUID();
      insWorkout.run(wkId, userId, wk.dayOfWeek, wk.code, wk.name, wk.subtitle, wk.sortOrder);
      wk.exercises.forEach((ex, idx) => {
        insExercise.run(
          crypto.randomUUID(),
          userId,
          wkId,
          ex.key,
          ex.name,
          ex.targetSets,
          ex.repMin,
          ex.repMax,
          ex.restMinSec,
          ex.restMaxSec,
          ex.defaultRestSec,
          ex.isCompound ? 1 : 0,
          JSON.stringify(ex.alternatives),
          idx + 1
        );
      });
    }
  }

  private recalculateSessionVolumeIfCompleted(userId: string, sessionId: string) {
    const sess = this.db
      .prepare('SELECT status FROM workout_sessions WHERE id = ? AND user_id = ?')
      .get(sessionId, userId) as { status: string } | undefined;
    if (!sess || sess.status !== 'completed') return;

    const sets = this.db
      .prepare('SELECT weight_kg, reps, completed FROM set_logs WHERE session_id = ? AND user_id = ?')
      .all(sessionId, userId) as Array<{ weight_kg: number | null; reps: number | null; completed: number }>;

    const total = sets
      .filter((s) => s.completed === 1)
      .reduce((acc, s) => acc + Number(s.weight_kg || 0) * Number(s.reps || 0), 0);

    this.db
      .prepare('UPDATE workout_sessions SET total_volume_kg = ? WHERE id = ? AND user_id = ?')
      .run(Number(total.toFixed(2)), sessionId, userId);
  }

  async countAdmins(): Promise<number> {
    const row = this.db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE role = 'ADMIN'").get() as { cnt: number };
    return row.cnt;
  }

  async getUserByUsername(username: string): Promise<UserAuthRecord | null> {
    const row = this.db
      .prepare('SELECT id, username, password_hash, role, is_blocked, created_at FROM users WHERE username = ?')
      .get(username) as unknown as UserAuthRecord | undefined;
    return row || null;
  }

  async getUserById(id: string): Promise<UserProfile | null> {
    const row = this.db
      .prepare('SELECT id, username, role, is_blocked, created_at FROM users WHERE id = ?')
      .get(id) as unknown as UserProfile | undefined;
    return row || null;
  }

  async resolveSession(token: string): Promise<{ user: UserProfile; token: string } | null> {
    const row = this.db
      .prepare(
        `SELECT u.id, u.username, u.role, u.is_blocked, u.created_at
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = ?`
      )
      .get(token) as unknown as UserProfile | undefined;
    if (!row || row.is_blocked) return null;
    return { user: row, token };
  }

  async createUserWithWorkouts(input: {
    id: string;
    username: string;
    password_hash: string;
    role: UserRole;
    created_at: number;
    claimSingleAdmin?: boolean;
  }): Promise<'OK' | 'USERNAME_EXISTS' | 'ADMIN_EXISTS'> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (input.claimSingleAdmin) {
        const admins = (this.db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE role = 'ADMIN'").get() as {
          cnt: number;
        }).cnt;
        if (admins > 0) {
          this.db.exec('ROLLBACK');
          return 'ADMIN_EXISTS';
        }
      }
      const existing = this.db.prepare('SELECT id FROM users WHERE username = ?').get(input.username);
      if (existing) {
        this.db.exec('ROLLBACK');
        return 'USERNAME_EXISTS';
      }
      this.db
        .prepare('INSERT INTO users (id, username, password_hash, role, is_blocked, created_at) VALUES (?, ?, ?, ?, 0, ?)')
        .run(input.id, input.username, input.password_hash, input.role, input.created_at);
      this.seedWorkoutsForUser(input.id);
      this.db.exec('COMMIT');
      return 'OK';
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  async createSession(token: string, userId: string, createdAt: number): Promise<void> {
    this.db
      .prepare('INSERT INTO user_sessions (token, user_id, created_at) VALUES (?, ?, ?)')
      .run(token, userId, createdAt);
  }

  async deleteSessionByToken(token: string): Promise<void> {
    this.db.prepare('DELETE FROM user_sessions WHERE token = ?').run(token);
  }

  async deleteSessionsByUser(userId: string): Promise<void> {
    this.db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);
  }

  async buildUserBootstrap(userId: string): Promise<BootstrapPayload> {
    const adminCount = await this.countAdmins();
    const user = await this.getUserById(userId);
    const workouts = this.db
      .prepare('SELECT * FROM workouts WHERE user_id = ? ORDER BY sort_order ASC')
      .all(userId) as unknown as Workout[];
    const rawExercises = this.db
      .prepare('SELECT * FROM exercises WHERE user_id = ? ORDER BY sort_order ASC')
      .all(userId) as Array<Record<string, unknown>>;
    const exercises = rawExercises.map((e) => ({
      ...e,
      alternatives: parseAlternatives(e.alternatives_json),
    })) as unknown as Exercise[];

    const sessions = this.db
      .prepare('SELECT * FROM workout_sessions WHERE user_id = ? ORDER BY started_at DESC')
      .all(userId) as unknown as WorkoutSession[];
    const setLogs = this.db
      .prepare('SELECT * FROM set_logs WHERE user_id = ? ORDER BY created_at ASC, set_number ASC')
      .all(userId) as unknown as SetLog[];
    const weightLogs = this.db
      .prepare('SELECT * FROM weight_logs WHERE user_id = ? ORDER BY recorded_at DESC, created_at DESC')
      .all(userId) as unknown as WeightLog[];

    const activeRow = sessions.find((s) => s.status === 'in_progress');
    let activeSession: ActiveSessionPayload | null = null;
    if (activeRow) {
      const seRows = this.db
        .prepare('SELECT * FROM session_exercises WHERE session_id = ? AND user_id = ? ORDER BY sort_order ASC')
        .all(activeRow.id, userId) as Array<Record<string, unknown>>;
      activeSession = {
        session: activeRow,
        items: seRows.map((se) => ({
          exercise: {
            ...se,
            alternatives: parseAlternatives(se.alternatives_json),
          } as unknown as SessionExercise,
          sets: setLogs.filter((s) => s.session_exercise_id === se.id),
        })),
      };
    }

    return {
      hasAdmin: adminCount > 0,
      user,
      workouts,
      exercises,
      sessions,
      setLogs,
      weightLogs,
      activeSession,
    };
  }

  async startWorkout(userId: string, workoutId: string): Promise<BootstrapPayload | 'NOT_FOUND'> {
    const existing = this.db
      .prepare("SELECT id FROM workout_sessions WHERE user_id = ? AND status = 'in_progress' LIMIT 1")
      .get(userId);
    if (existing) {
      return this.buildUserBootstrap(userId);
    }

    const workout = this.db
      .prepare('SELECT * FROM workouts WHERE id = ? AND user_id = ?')
      .get(workoutId, userId) as { id: string; name: string } | undefined;
    if (!workout) return 'NOT_FOUND';

    const exercises = this.db
      .prepare('SELECT * FROM exercises WHERE workout_id = ? AND user_id = ? ORDER BY sort_order ASC')
      .all(workoutId, userId) as Array<{
      id: string;
      exercise_key: string;
      name: string;
      target_sets: number;
      rep_min: number;
      rep_max: number;
      default_rest_sec: number;
      alternatives_json: string;
      sort_order: number;
    }>;

    const now = Date.now();
    const sessionId = crypto.randomUUID();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db
        .prepare(
          "INSERT INTO workout_sessions (id, user_id, workout_id, workout_name, started_at, completed_at, status, total_volume_kg) VALUES (?, ?, ?, ?, ?, NULL, 'in_progress', 0)"
        )
        .run(sessionId, userId, workout.id, workout.name, now);

      const insSe = this.db.prepare(
        'INSERT INTO session_exercises (id, user_id, session_id, workout_exercise_id, original_exercise_key, original_exercise_name, performed_exercise_key, performed_exercise_name, target_sets, rep_min, rep_max, default_rest_sec, alternatives_json, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      const insSet = this.db.prepare(
        'INSERT INTO set_logs (id, user_id, session_id, session_exercise_id, exercise_key, exercise_name, set_number, weight_kg, reps, rir, planned_rest_sec, actual_rest_sec, completed, completed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, 0, NULL, ?)'
      );

      for (const ex of exercises) {
        const seId = crypto.randomUUID();
        insSe.run(
          seId,
          userId,
          sessionId,
          ex.id,
          ex.exercise_key,
          ex.name,
          ex.exercise_key,
          ex.name,
          ex.target_sets,
          ex.rep_min,
          ex.rep_max,
          ex.default_rest_sec,
          ex.alternatives_json,
          ex.sort_order
        );
        for (let s = 1; s <= ex.target_sets; s++) {
          insSet.run(
            crypto.randomUUID(),
            userId,
            sessionId,
            seId,
            ex.exercise_key,
            ex.name,
            s,
            ex.default_rest_sec,
            now + s
          );
        }
      }
      this.db.exec('COMMIT');
      return this.buildUserBootstrap(userId);
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  async getSessionDetail(userId: string, sessionId: string): Promise<ActiveSessionPayload | null> {
    const sess = this.db
      .prepare('SELECT * FROM workout_sessions WHERE id = ? AND user_id = ?')
      .get(sessionId, userId) as unknown as WorkoutSession | undefined;
    if (!sess) return null;

    const seRows = this.db
      .prepare('SELECT * FROM session_exercises WHERE session_id = ? AND user_id = ? ORDER BY sort_order ASC')
      .all(sessionId, userId) as Array<Record<string, unknown>>;
    const sets = this.db
      .prepare('SELECT * FROM set_logs WHERE session_id = ? AND user_id = ? ORDER BY set_number ASC')
      .all(sessionId, userId) as unknown as SetLog[];

    return {
      session: sess,
      items: seRows.map((se) => ({
        exercise: { ...se, alternatives: parseAlternatives(se.alternatives_json) } as unknown as SessionExercise,
        sets: sets.filter((s) => s.session_exercise_id === se.id),
      })),
    };
  }

  async finishSession(userId: string, sessionId: string): Promise<BootstrapPayload | 'NOT_FOUND'> {
    const sess = this.db
      .prepare('SELECT id FROM workout_sessions WHERE id = ? AND user_id = ?')
      .get(sessionId, userId);
    if (!sess) return 'NOT_FOUND';

    const sets = this.db
      .prepare('SELECT weight_kg, reps, completed FROM set_logs WHERE session_id = ? AND user_id = ?')
      .all(sessionId, userId) as Array<{ weight_kg: number | null; reps: number | null; completed: number }>;

    const total = sets
      .filter((s) => s.completed === 1)
      .reduce((acc, s) => acc + Number(s.weight_kg || 0) * Number(s.reps || 0), 0);

    this.db
      .prepare("UPDATE workout_sessions SET status = 'completed', completed_at = ?, total_volume_kg = ? WHERE id = ? AND user_id = ?")
      .run(Date.now(), Number(total.toFixed(2)), sessionId, userId);

    return this.buildUserBootstrap(userId);
  }

  async discardSession(userId: string, sessionId: string): Promise<BootstrapPayload> {
    this.db.prepare('DELETE FROM workout_sessions WHERE id = ? AND user_id = ?').run(sessionId, userId);
    return this.buildUserBootstrap(userId);
  }

  async substituteExercise(
    userId: string,
    seId: string,
    opts: { key: string; name: string; defaultRestSec: number; updateAllSets: boolean }
  ): Promise<BootstrapPayload | 'NOT_FOUND'> {
    const se = this.db.prepare('SELECT id FROM session_exercises WHERE id = ? AND user_id = ?').get(seId, userId);
    if (!se) return 'NOT_FOUND';

    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db
        .prepare(
          'UPDATE session_exercises SET performed_exercise_key = ?, performed_exercise_name = ?, default_rest_sec = ? WHERE id = ? AND user_id = ?'
        )
        .run(opts.key, opts.name, opts.defaultRestSec, seId, userId);

      if (opts.updateAllSets) {
        this.db
          .prepare('UPDATE set_logs SET exercise_key = ?, exercise_name = ? WHERE session_exercise_id = ? AND user_id = ?')
          .run(opts.key, opts.name, seId, userId);
      } else {
        this.db
          .prepare(
            'UPDATE set_logs SET exercise_key = ?, exercise_name = ?, planned_rest_sec = ? WHERE session_exercise_id = ? AND user_id = ? AND completed = 0'
          )
          .run(opts.key, opts.name, opts.defaultRestSec, seId, userId);
      }
      this.db.exec('COMMIT');
      return this.buildUserBootstrap(userId);
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  async addSet(userId: string, seId: string): Promise<BootstrapPayload | 'NOT_FOUND'> {
    const se = this.db.prepare('SELECT * FROM session_exercises WHERE id = ? AND user_id = ?').get(seId, userId) as
      | {
          id: string;
          session_id: string;
          performed_exercise_key: string;
          performed_exercise_name: string;
          default_rest_sec: number;
        }
      | undefined;
    if (!se) return 'NOT_FOUND';

    const maxRow = this.db
      .prepare('SELECT COALESCE(MAX(set_number), 0) AS max_num FROM set_logs WHERE session_exercise_id = ? AND user_id = ?')
      .get(seId, userId) as { max_num: number };

    this.db
      .prepare(
        'INSERT INTO set_logs (id, user_id, session_id, session_exercise_id, exercise_key, exercise_name, set_number, weight_kg, reps, rir, planned_rest_sec, actual_rest_sec, completed, completed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, 0, NULL, ?)'
      )
      .run(
        crypto.randomUUID(),
        userId,
        se.session_id,
        se.id,
        se.performed_exercise_key,
        se.performed_exercise_name,
        maxRow.max_num + 1,
        se.default_rest_sec,
        Date.now()
      );

    return this.buildUserBootstrap(userId);
  }

  async updateSet(userId: string, setId: string, body: Record<string, unknown>): Promise<SetLog | null> {
    const current = this.db
      .prepare('SELECT * FROM set_logs WHERE id = ? AND user_id = ?')
      .get(setId, userId) as unknown as SetLog | undefined;
    if (!current) return null;

    const p = normalizeSetPatch(current, body);
    this.db
      .prepare(
        'UPDATE set_logs SET weight_kg = ?, reps = ?, rir = ?, planned_rest_sec = ?, actual_rest_sec = ?, completed = ?, completed_at = ? WHERE id = ? AND user_id = ?'
      )
      .run(p.weight_kg, p.reps, p.rir, p.planned_rest_sec, p.actual_rest_sec, p.completed, p.completed_at, setId, userId);

    this.recalculateSessionVolumeIfCompleted(userId, current.session_id);
    return this.db
      .prepare('SELECT * FROM set_logs WHERE id = ? AND user_id = ?')
      .get(setId, userId) as unknown as SetLog;
  }

  async deleteSet(userId: string, setId: string): Promise<BootstrapPayload> {
    const current = this.db
      .prepare('SELECT session_id FROM set_logs WHERE id = ? AND user_id = ?')
      .get(setId, userId) as { session_id: string } | undefined;
    if (current) {
      this.db.prepare('DELETE FROM set_logs WHERE id = ? AND user_id = ?').run(setId, userId);
      this.recalculateSessionVolumeIfCompleted(userId, current.session_id);
    }
    return this.buildUserBootstrap(userId);
  }

  async logWeight(userId: string, weightKg: number): Promise<BootstrapPayload> {
    const now = Date.now();
    this.db
      .prepare('INSERT INTO weight_logs (id, user_id, weight_kg, recorded_at, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), userId, Number(weightKg.toFixed(2)), now, now);
    return this.buildUserBootstrap(userId);
  }

  async deleteWeight(userId: string, id: string): Promise<BootstrapPayload> {
    this.db.prepare('DELETE FROM weight_logs WHERE id = ? AND user_id = ?').run(id, userId);
    return this.buildUserBootstrap(userId);
  }

  async updateWorkoutSchedule(
    userId: string,
    assignments: Array<{ workoutId: string; dayOfWeek: number }>
  ): Promise<BootstrapPayload | 'INVALID'> {
    const userWorkouts = this.db
      .prepare('SELECT id, code FROM workouts WHERE user_id = ?')
      .all(userId) as Array<{ id: string; code: string }>;
    if (assignments.length !== userWorkouts.length) return 'INVALID';

    const byId = new Map(userWorkouts.map((w) => [w.id, w.code]));
    const seenIds = new Set<string>();
    const seenDays = new Set<number>();

    for (const item of assignments) {
      if (!byId.has(item.workoutId) || seenIds.has(item.workoutId)) return 'INVALID';
      if (!Number.isInteger(item.dayOfWeek) || item.dayOfWeek < 1 || item.dayOfWeek > 7) return 'INVALID';
      if (seenDays.has(item.dayOfWeek)) return 'INVALID';
      seenIds.add(item.workoutId);
      seenDays.add(item.dayOfWeek);
    }

    this.db.exec('BEGIN IMMEDIATE');
    try {
      const stmt = this.db.prepare(
        'UPDATE workouts SET day_of_week = ?, name = ?, sort_order = ? WHERE id = ? AND user_id = ?'
      );
      for (const item of assignments) {
        const code = byId.get(item.workoutId)!;
        stmt.run(
          item.dayOfWeek,
          formatWorkoutNameForDay(code, item.dayOfWeek),
          item.dayOfWeek,
          item.workoutId,
          userId
        );
      }
      this.db.exec('COMMIT');
      return this.buildUserBootstrap(userId);
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  async listUsers(): Promise<UserProfile[]> {
    return this.db
      .prepare('SELECT id, username, role, is_blocked, created_at FROM users ORDER BY created_at DESC')
      .all() as unknown as UserProfile[];
  }

  async toggleBlockUser(targetId: string, blocked: boolean): Promise<UserProfile[]> {
    this.db.prepare('UPDATE users SET is_blocked = ? WHERE id = ?').run(blocked ? 1 : 0, targetId);
    if (blocked) {
      this.db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(targetId);
    }
    return this.listUsers();
  }

  async resetUserPassword(targetId: string, passwordHash: string): Promise<void> {
    this.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, targetId);
    this.db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(targetId);
  }

  async deleteUser(targetId: string): Promise<UserProfile[]> {
    this.db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    return this.listUsers();
  }
}

// =============================================================================
// SUPABASE STORE (PostgREST over HTTPS using server-side env vars)
// =============================================================================
class SupabaseError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class SupabaseStore implements IronLogStore {
  private restBase: string;
  private apiKey: string;

  constructor(restBase: string, apiKey: string) {
    this.restBase = restBase;
    this.apiKey = apiKey;
  }

  private async req<T>(pathWithQuery: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers || {});
    headers.set('apikey', this.apiKey);
    if (this.apiKey.startsWith('eyJ')) {
      headers.set('Authorization', `Bearer ${this.apiKey}`);
    }
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(`${this.restBase}${pathWithQuery}`, {
      ...init,
      headers,
    });

    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      const errObj = (parsed && typeof parsed === 'object' ? parsed : {}) as {
        message?: string;
        code?: string;
      };
      const rawMsg = errObj.message || `Erro Supabase (${res.status})`;
      if (errObj.code === '42501' || rawMsg.toLowerCase().includes('row-level security policy')) {
        throw new SupabaseError(
          403,
          'Permissão bloqueada pelo RLS do Supabase. Execute o script de liberação (DISABLE ROW LEVEL SECURITY) no SQL Editor do Supabase ou configure SUPABASE_SERVICE_ROLE_KEY.',
          errObj.code
        );
      }
      throw new SupabaseError(res.status, rawMsg, errObj.code);
    }
    return parsed as T;
  }

  async ping(): Promise<void> {
    await this.req('/users?select=id&limit=1', {
      signal: AbortSignal.timeout(3500),
    });
  }

  private async seedWorkoutsForUser(userId: string): Promise<void> {
    const existing = await this.req<Array<{ id: string }>>(
      `/workouts?select=id&user_id=eq.${encodeURIComponent(userId)}&limit=1`
    );
    if (existing.length > 0) return;

    const workoutRows: Array<Record<string, unknown>> = [];
    const exerciseRows: Array<Record<string, unknown>> = [];

    for (const wk of DEFAULT_WORKOUT_SPLIT) {
      const wkId = crypto.randomUUID();
      workoutRows.push({
        id: wkId,
        user_id: userId,
        day_of_week: wk.dayOfWeek,
        code: wk.code,
        name: wk.name,
        subtitle: wk.subtitle,
        sort_order: wk.sortOrder,
      });
      wk.exercises.forEach((ex, idx) => {
        exerciseRows.push({
          id: crypto.randomUUID(),
          user_id: userId,
          workout_id: wkId,
          exercise_key: ex.key,
          name: ex.name,
          target_sets: ex.targetSets,
          rep_min: ex.repMin,
          rep_max: ex.repMax,
          rest_min_sec: ex.restMinSec,
          rest_max_sec: ex.restMaxSec,
          default_rest_sec: ex.defaultRestSec,
          is_compound: ex.isCompound ? 1 : 0,
          alternatives_json: JSON.stringify(ex.alternatives),
          sort_order: idx + 1,
        });
      });
    }

    await this.req('/workouts', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(workoutRows),
    });
    await this.req('/exercises', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(exerciseRows),
    });
  }

  private async recalculateSessionVolumeIfCompleted(userId: string, sessionId: string): Promise<void> {
    const rows = await this.req<Array<{ status: string }>>(
      `/workout_sessions?select=status&id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`
    );
    if (!rows[0] || rows[0].status !== 'completed') return;

    const sets = await this.req<Array<{ weight_kg: number | null; reps: number | null; completed: number }>>(
      `/set_logs?select=weight_kg,reps,completed&session_id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(userId)}`
    );
    const total = sets
      .filter((s) => s.completed === 1)
      .reduce((acc, s) => acc + Number(s.weight_kg || 0) * Number(s.reps || 0), 0);

    await this.req(
      `/workout_sessions?id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ total_volume_kg: Number(total.toFixed(2)) }),
      }
    );
  }

  async countAdmins(): Promise<number> {
    const rows = await this.req<Array<{ id: string }>>("/users?select=id&role=eq.ADMIN");
    return rows.length;
  }

  async getUserByUsername(username: string): Promise<UserAuthRecord | null> {
    const rows = await this.req<UserAuthRecord[]>(
      `/users?select=id,username,password_hash,role,is_blocked,created_at&username=eq.${encodeURIComponent(username)}&limit=1`
    );
    return rows[0] || null;
  }

  async getUserById(id: string): Promise<UserProfile | null> {
    const rows = await this.req<UserProfile[]>(
      `/users?select=id,username,role,is_blocked,created_at&id=eq.${encodeURIComponent(id)}&limit=1`
    );
    return rows[0] || null;
  }

  async resolveSession(token: string): Promise<{ user: UserProfile; token: string } | null> {
    const sessRows = await this.req<Array<{ user_id: string }>>(
      `/user_sessions?select=user_id&token=eq.${encodeURIComponent(token)}&limit=1`
    );
    const userId = sessRows[0]?.user_id;
    if (!userId) return null;

    const user = await this.getUserById(userId);
    if (!user || user.is_blocked) return null;
    return { user, token };
  }

  async createUserWithWorkouts(input: {
    id: string;
    username: string;
    password_hash: string;
    role: UserRole;
    created_at: number;
    claimSingleAdmin?: boolean;
  }): Promise<'OK' | 'USERNAME_EXISTS' | 'ADMIN_EXISTS'> {
    if (input.claimSingleAdmin) {
      const admins = await this.countAdmins();
      if (admins > 0) return 'ADMIN_EXISTS';
    }
    const existing = await this.getUserByUsername(input.username);
    if (existing) return 'USERNAME_EXISTS';

    try {
      await this.req('/users', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          id: input.id,
          username: input.username,
          password_hash: input.password_hash,
          role: input.role,
          is_blocked: 0,
          created_at: input.created_at,
        }),
      });
    } catch (err) {
      if (err instanceof SupabaseError && err.status === 409) {
        return 'USERNAME_EXISTS';
      }
      throw err;
    }

    await this.seedWorkoutsForUser(input.id);
    return 'OK';
  }

  async createSession(token: string, userId: string, createdAt: number): Promise<void> {
    await this.req('/user_sessions', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ token, user_id: userId, created_at: createdAt }),
    });
  }

  async deleteSessionByToken(token: string): Promise<void> {
    await this.req(`/user_sessions?token=eq.${encodeURIComponent(token)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });
  }

  async deleteSessionsByUser(userId: string): Promise<void> {
    await this.req(`/user_sessions?user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });
  }

  async buildUserBootstrap(userId: string): Promise<BootstrapPayload> {
    const encUser = encodeURIComponent(userId);
    const [adminCount, user, workouts, rawExercises, sessions, setLogs, weightLogs] = await Promise.all([
      this.countAdmins(),
      this.getUserById(userId),
      this.req<Workout[]>(`/workouts?select=*&user_id=eq.${encUser}&order=sort_order.asc`),
      this.req<Array<Record<string, unknown>>>(`/exercises?select=*&user_id=eq.${encUser}&order=sort_order.asc`),
      this.req<WorkoutSession[]>(`/workout_sessions?select=*&user_id=eq.${encUser}&order=started_at.desc`),
      this.req<SetLog[]>(`/set_logs?select=*&user_id=eq.${encUser}&order=created_at.asc,set_number.asc`),
      this.req<WeightLog[]>(`/weight_logs?select=*&user_id=eq.${encUser}&order=recorded_at.desc,created_at.desc`),
    ]);

    const exercises = rawExercises.map((e) => ({
      ...e,
      alternatives: parseAlternatives(e.alternatives_json),
    })) as unknown as Exercise[];

    const activeRow = sessions.find((s) => s.status === 'in_progress');
    let activeSession: ActiveSessionPayload | null = null;
    if (activeRow) {
      const seRows = await this.req<Array<Record<string, unknown>>>(
        `/session_exercises?select=*&session_id=eq.${encodeURIComponent(activeRow.id)}&user_id=eq.${encUser}&order=sort_order.asc`
      );
      activeSession = {
        session: activeRow,
        items: seRows.map((se) => ({
          exercise: {
            ...se,
            alternatives: parseAlternatives(se.alternatives_json),
          } as unknown as SessionExercise,
          sets: setLogs.filter((s) => s.session_exercise_id === se.id),
        })),
      };
    }

    return {
      hasAdmin: adminCount > 0,
      user,
      workouts,
      exercises,
      sessions,
      setLogs,
      weightLogs,
      activeSession,
    };
  }

  async startWorkout(userId: string, workoutId: string): Promise<BootstrapPayload | 'NOT_FOUND'> {
    const encUser = encodeURIComponent(userId);
    const existing = await this.req<Array<{ id: string }>>(
      `/workout_sessions?select=id&user_id=eq.${encUser}&status=eq.in_progress&limit=1`
    );
    if (existing.length > 0) {
      return this.buildUserBootstrap(userId);
    }

    const workouts = await this.req<Array<{ id: string; name: string }>>(
      `/workouts?select=id,name&id=eq.${encodeURIComponent(workoutId)}&user_id=eq.${encUser}&limit=1`
    );
    const workout = workouts[0];
    if (!workout) return 'NOT_FOUND';

    const exercises = await this.req<Array<Record<string, unknown>>>(
      `/exercises?select=*&workout_id=eq.${encodeURIComponent(workoutId)}&user_id=eq.${encUser}&order=sort_order.asc`
    );

    const now = Date.now();
    const sessionId = crypto.randomUUID();

    await this.req('/workout_sessions', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: sessionId,
        user_id: userId,
        workout_id: workout.id,
        workout_name: workout.name,
        started_at: now,
        completed_at: null,
        status: 'in_progress',
        total_volume_kg: 0,
      }),
    });

    const seRows: Array<Record<string, unknown>> = [];
    const setRows: Array<Record<string, unknown>> = [];

    for (const ex of exercises) {
      const seId = crypto.randomUUID();
      const targetSets = Number(ex.target_sets || 1);
      const defaultRest = Number(ex.default_rest_sec || 90);
      seRows.push({
        id: seId,
        user_id: userId,
        session_id: sessionId,
        workout_exercise_id: String(ex.id),
        original_exercise_key: String(ex.exercise_key),
        original_exercise_name: String(ex.name),
        performed_exercise_key: String(ex.exercise_key),
        performed_exercise_name: String(ex.name),
        target_sets: targetSets,
        rep_min: Number(ex.rep_min || 8),
        rep_max: Number(ex.rep_max || 12),
        default_rest_sec: defaultRest,
        alternatives_json: String(ex.alternatives_json || '[]'),
        sort_order: Number(ex.sort_order || 1),
      });

      for (let s = 1; s <= targetSets; s++) {
        setRows.push({
          id: crypto.randomUUID(),
          user_id: userId,
          session_id: sessionId,
          session_exercise_id: seId,
          exercise_key: String(ex.exercise_key),
          exercise_name: String(ex.name),
          set_number: s,
          weight_kg: null,
          reps: null,
          rir: null,
          planned_rest_sec: defaultRest,
          actual_rest_sec: null,
          completed: 0,
          completed_at: null,
          created_at: now + s,
        });
      }
    }

    if (seRows.length > 0) {
      await this.req('/session_exercises', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(seRows),
      });
    }
    if (setRows.length > 0) {
      await this.req('/set_logs', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(setRows),
      });
    }

    return this.buildUserBootstrap(userId);
  }

  async getSessionDetail(userId: string, sessionId: string): Promise<ActiveSessionPayload | null> {
    const encUser = encodeURIComponent(userId);
    const encSess = encodeURIComponent(sessionId);
    const sessRows = await this.req<WorkoutSession[]>(
      `/workout_sessions?select=*&id=eq.${encSess}&user_id=eq.${encUser}&limit=1`
    );
    const sess = sessRows[0];
    if (!sess) return null;

    const [seRows, sets] = await Promise.all([
      this.req<Array<Record<string, unknown>>>(
        `/session_exercises?select=*&session_id=eq.${encSess}&user_id=eq.${encUser}&order=sort_order.asc`
      ),
      this.req<SetLog[]>(
        `/set_logs?select=*&session_id=eq.${encSess}&user_id=eq.${encUser}&order=set_number.asc`
      ),
    ]);

    return {
      session: sess,
      items: seRows.map((se) => ({
        exercise: { ...se, alternatives: parseAlternatives(se.alternatives_json) } as unknown as SessionExercise,
        sets: sets.filter((s) => s.session_exercise_id === se.id),
      })),
    };
  }

  async finishSession(userId: string, sessionId: string): Promise<BootstrapPayload | 'NOT_FOUND'> {
    const encUser = encodeURIComponent(userId);
    const encSess = encodeURIComponent(sessionId);
    const sessRows = await this.req<Array<{ id: string }>>(
      `/workout_sessions?select=id&id=eq.${encSess}&user_id=eq.${encUser}&limit=1`
    );
    if (!sessRows[0]) return 'NOT_FOUND';

    const sets = await this.req<Array<{ weight_kg: number | null; reps: number | null; completed: number }>>(
      `/set_logs?select=weight_kg,reps,completed&session_id=eq.${encSess}&user_id=eq.${encUser}`
    );
    const total = sets
      .filter((s) => s.completed === 1)
      .reduce((acc, s) => acc + Number(s.weight_kg || 0) * Number(s.reps || 0), 0);

    await this.req(`/workout_sessions?id=eq.${encSess}&user_id=eq.${encUser}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'completed',
        completed_at: Date.now(),
        total_volume_kg: Number(total.toFixed(2)),
      }),
    });

    return this.buildUserBootstrap(userId);
  }

  async discardSession(userId: string, sessionId: string): Promise<BootstrapPayload> {
    await this.req(
      `/workout_sessions?id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      }
    );
    return this.buildUserBootstrap(userId);
  }

  async substituteExercise(
    userId: string,
    seId: string,
    opts: { key: string; name: string; defaultRestSec: number; updateAllSets: boolean }
  ): Promise<BootstrapPayload | 'NOT_FOUND'> {
    const encUser = encodeURIComponent(userId);
    const encSe = encodeURIComponent(seId);
    const rows = await this.req<Array<{ id: string }>>(
      `/session_exercises?select=id&id=eq.${encSe}&user_id=eq.${encUser}&limit=1`
    );
    if (!rows[0]) return 'NOT_FOUND';

    await this.req(`/session_exercises?id=eq.${encSe}&user_id=eq.${encUser}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        performed_exercise_key: opts.key,
        performed_exercise_name: opts.name,
        default_rest_sec: opts.defaultRestSec,
      }),
    });

    if (opts.updateAllSets) {
      await this.req(`/set_logs?session_exercise_id=eq.${encSe}&user_id=eq.${encUser}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          exercise_key: opts.key,
          exercise_name: opts.name,
        }),
      });
    } else {
      await this.req(`/set_logs?session_exercise_id=eq.${encSe}&user_id=eq.${encUser}&completed=eq.0`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          exercise_key: opts.key,
          exercise_name: opts.name,
          planned_rest_sec: opts.defaultRestSec,
        }),
      });
    }

    return this.buildUserBootstrap(userId);
  }

  async addSet(userId: string, seId: string): Promise<BootstrapPayload | 'NOT_FOUND'> {
    const encUser = encodeURIComponent(userId);
    const encSe = encodeURIComponent(seId);
    const seRows = await this.req<
      Array<{
        id: string;
        session_id: string;
        performed_exercise_key: string;
        performed_exercise_name: string;
        default_rest_sec: number;
      }>
    >(`/session_exercises?select=id,session_id,performed_exercise_key,performed_exercise_name,default_rest_sec&id=eq.${encSe}&user_id=eq.${encUser}&limit=1`);
    const se = seRows[0];
    if (!se) return 'NOT_FOUND';

    const maxRows = await this.req<Array<{ set_number: number }>>(
      `/set_logs?select=set_number&session_exercise_id=eq.${encSe}&user_id=eq.${encUser}&order=set_number.desc&limit=1`
    );
    const maxNum = maxRows[0]?.set_number || 0;

    await this.req('/set_logs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        user_id: userId,
        session_id: se.session_id,
        session_exercise_id: se.id,
        exercise_key: se.performed_exercise_key,
        exercise_name: se.performed_exercise_name,
        set_number: maxNum + 1,
        weight_kg: null,
        reps: null,
        rir: null,
        planned_rest_sec: se.default_rest_sec,
        actual_rest_sec: null,
        completed: 0,
        completed_at: null,
        created_at: Date.now(),
      }),
    });

    return this.buildUserBootstrap(userId);
  }

  async updateSet(userId: string, setId: string, body: Record<string, unknown>): Promise<SetLog | null> {
    const encUser = encodeURIComponent(userId);
    const encSet = encodeURIComponent(setId);
    const currentRows = await this.req<SetLog[]>(
      `/set_logs?select=*&id=eq.${encSet}&user_id=eq.${encUser}&limit=1`
    );
    const current = currentRows[0];
    if (!current) return null;

    const p = normalizeSetPatch(current, body);
    const updatedRows = await this.req<SetLog[]>(
      `/set_logs?id=eq.${encSet}&user_id=eq.${encUser}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(p),
      }
    );

    await this.recalculateSessionVolumeIfCompleted(userId, current.session_id);
    return updatedRows[0] || current;
  }

  async deleteSet(userId: string, setId: string): Promise<BootstrapPayload> {
    const encUser = encodeURIComponent(userId);
    const encSet = encodeURIComponent(setId);
    const currentRows = await this.req<Array<{ session_id: string }>>(
      `/set_logs?select=session_id&id=eq.${encSet}&user_id=eq.${encUser}&limit=1`
    );
    const current = currentRows[0];
    if (current) {
      await this.req(`/set_logs?id=eq.${encSet}&user_id=eq.${encUser}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
      await this.recalculateSessionVolumeIfCompleted(userId, current.session_id);
    }
    return this.buildUserBootstrap(userId);
  }

  async logWeight(userId: string, weightKg: number): Promise<BootstrapPayload> {
    const now = Date.now();
    await this.req('/weight_logs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        user_id: userId,
        weight_kg: Number(weightKg.toFixed(2)),
        recorded_at: now,
        created_at: now,
      }),
    });
    return this.buildUserBootstrap(userId);
  }

  async deleteWeight(userId: string, id: string): Promise<BootstrapPayload> {
    await this.req(
      `/weight_logs?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      }
    );
    return this.buildUserBootstrap(userId);
  }

  async updateWorkoutSchedule(
    userId: string,
    assignments: Array<{ workoutId: string; dayOfWeek: number }>
  ): Promise<BootstrapPayload | 'INVALID'> {
    const encUser = encodeURIComponent(userId);
    const userWorkouts = await this.req<Array<{ id: string; code: string }>>(
      `/workouts?select=id,code&user_id=eq.${encUser}`
    );
    if (assignments.length !== userWorkouts.length) return 'INVALID';

    const byId = new Map(userWorkouts.map((w) => [w.id, w.code]));
    const seenIds = new Set<string>();
    const seenDays = new Set<number>();

    for (const item of assignments) {
      if (!byId.has(item.workoutId) || seenIds.has(item.workoutId)) return 'INVALID';
      if (!Number.isInteger(item.dayOfWeek) || item.dayOfWeek < 1 || item.dayOfWeek > 7) return 'INVALID';
      if (seenDays.has(item.dayOfWeek)) return 'INVALID';
      seenIds.add(item.workoutId);
      seenDays.add(item.dayOfWeek);
    }

    await Promise.all(
      assignments.map((item) => {
        const code = byId.get(item.workoutId)!;
        return this.req(
          `/workouts?id=eq.${encodeURIComponent(item.workoutId)}&user_id=eq.${encUser}`,
          {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
              day_of_week: item.dayOfWeek,
              name: formatWorkoutNameForDay(code, item.dayOfWeek),
              sort_order: item.dayOfWeek,
            }),
          }
        );
      })
    );

    return this.buildUserBootstrap(userId);
  }

  async listUsers(): Promise<UserProfile[]> {
    return this.req<UserProfile[]>(
      '/users?select=id,username,role,is_blocked,created_at&order=created_at.desc'
    );
  }

  async toggleBlockUser(targetId: string, blocked: boolean): Promise<UserProfile[]> {
    await this.req(`/users?id=eq.${encodeURIComponent(targetId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ is_blocked: blocked ? 1 : 0 }),
    });
    if (blocked) {
      await this.deleteSessionsByUser(targetId);
    }
    return this.listUsers();
  }

  async resetUserPassword(targetId: string, passwordHash: string): Promise<void> {
    await this.req(`/users?id=eq.${encodeURIComponent(targetId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ password_hash: passwordHash }),
    });
    await this.deleteSessionsByUser(targetId);
  }

  async deleteUser(targetId: string): Promise<UserProfile[]> {
    await this.req(`/users?id=eq.${encodeURIComponent(targetId)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });
    return this.listUsers();
  }
}

// =============================================================================
// STORE SELECTOR (Uses Supabase when configured & schema exists, else SQLite)
// =============================================================================
const rawSupabaseUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const supabaseRestBase = rawSupabaseUrl
  ? rawSupabaseUrl.endsWith('/rest/v1')
    ? rawSupabaseUrl
    : `${rawSupabaseUrl}/rest/v1`
  : '';
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
const supabaseConfigured = Boolean(supabaseRestBase && supabaseKey);

let sqliteStoreInstance: SqliteStore | null = null;
function getSqliteStore(): SqliteStore {
  if (!sqliteStoreInstance) {
    sqliteStoreInstance = supabaseRequired
      ? new SqliteStore(path.join(os.tmpdir(), 'ironlog-demo.db'))
      : new SqliteStore();
  }
  return sqliteStoreInstance;
}

// When enabled (on Netlify), SQLite is only used as a temporary DEMO store while
// Supabase is not configured (missing SUPABASE_URL / key). Its file lives in
// per-instance /tmp storage, so demo data is lost on restart. Once Supabase is
// configured, the app never falls back to SQLite.
let supabaseRequired = false;
export function requireSupabase() {
  supabaseRequired = true;
}

class StorageUnavailableError extends Error {
  status = 503;
}

function sqliteFallback(status: StorageStatus): { store: IronLogStore; status: StorageStatus } {
  if (supabaseRequired && !status.supabaseConfigured) {
    if (!sqliteStoreInstance) console.warn(
      'IRON LOG: MODO DEMO — Supabase não configurado (defina SUPABASE_URL). Dados temporários não serão mantidos.'
    );
  } else if (supabaseRequired) {
    const reason = !status.supabaseConfigured
      ? 'Supabase não configurado (defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).'
      : status.supabaseNeedsSchema
        ? 'Tabelas do Supabase ausentes. Execute supabase/schema.sql no SQL Editor do Supabase.'
        : 'Não foi possível conectar ao Supabase. Tente novamente.';
    throw new StorageUnavailableError(`Banco de dados indisponível: ${reason}`);
  }
  return { store: getSqliteStore(), status };
}
const supabaseStore = supabaseConfigured ? new SupabaseStore(supabaseRestBase, supabaseKey) : null;

let cachedSupabaseReady = false;
let cachedSupabaseNeedsSchema = false;
let lastProbeMs = 0;

function isMissingSchemaError(err: unknown): boolean {
  if (!(err instanceof SupabaseError)) return false;
  return (
    err.code === 'PGRST205' ||
    err.code === '42P01' ||
    (err.status === 404 && err.message.toLowerCase().includes('schema cache'))
  );
}

export async function getActiveStore(): Promise<{ store: IronLogStore; status: StorageStatus }> {
  if (!supabaseStore) {
    return sqliteFallback({
      backend: 'sqlite',
      supabaseConfigured: false,
      supabaseReady: false,
      supabaseNeedsSchema: false,
    });
  }

  if (cachedSupabaseReady) {
    return {
      store: supabaseStore,
      status: {
        backend: 'supabase',
        supabaseConfigured: true,
        supabaseReady: true,
        supabaseNeedsSchema: false,
      },
    };
  }

  const now = Date.now();
  if (now - lastProbeMs > 4000) {
    lastProbeMs = now;
    try {
      await supabaseStore.ping();
      cachedSupabaseReady = true;
      cachedSupabaseNeedsSchema = false;
      console.log('IRON LOG: Conectado ao banco de dados Supabase.');
    } catch (err) {
      if (isMissingSchemaError(err)) {
        cachedSupabaseNeedsSchema = true;
      } else {
        console.warn('IRON LOG: Aviso ao consultar Supabase:', err instanceof Error ? err.message : err);
      }
    }
  }

  if (cachedSupabaseReady) {
    return {
      store: supabaseStore,
      status: {
        backend: 'supabase',
        supabaseConfigured: true,
        supabaseReady: true,
        supabaseNeedsSchema: false,
      },
    };
  }

  return sqliteFallback({
    backend: 'sqlite',
    supabaseConfigured: true,
    supabaseReady: false,
    supabaseNeedsSchema: cachedSupabaseNeedsSchema,
  });
}
