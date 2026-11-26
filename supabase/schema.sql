-- IRON LOG - Schema PostgreSQL para Supabase
-- Execute este script no SQL Editor do seu projeto Supabase.

CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ALUNO', 'ADMIN')),
  is_blocked INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.workouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  UNIQUE (user_id, code)
);

CREATE TABLE IF NOT EXISTS public.exercises (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workout_id TEXT NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workout_id TEXT,
  workout_name TEXT NOT NULL,
  started_at BIGINT NOT NULL,
  completed_at BIGINT,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
  total_volume_kg DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.session_exercises (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.set_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  session_exercise_id TEXT NOT NULL REFERENCES public.session_exercises(id) ON DELETE CASCADE,
  exercise_key TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  set_number INTEGER NOT NULL,
  weight_kg DOUBLE PRECISION,
  reps INTEGER,
  rir INTEGER,
  planned_rest_sec INTEGER NOT NULL,
  actual_rest_sec INTEGER,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at BIGINT,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.weight_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  weight_kg DOUBLE PRECISION NOT NULL,
  recorded_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workouts_user ON public.workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_exercises_workout ON public.exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.workout_sessions(user_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_ex ON public.session_exercises(session_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_set_logs_user_ex ON public.set_logs(user_id, exercise_key, created_at);
CREATE INDEX IF NOT EXISTS idx_set_logs_se_num ON public.set_logs(session_exercise_id, set_number);
CREATE INDEX IF NOT EXISTS idx_weight_logs_user ON public.weight_logs(user_id, recorded_at DESC);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_exercises DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.set_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_logs DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
