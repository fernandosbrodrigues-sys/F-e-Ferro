export type UserRole = 'ALUNO' | 'ADMIN';
export type MainTab = 'inicio' | 'treinos' | 'historico' | 'perfil';

export interface UserProfile {
  id: string;
  username: string;
  role: UserRole;
  is_blocked: number;
  created_at: number;
}

export interface AlternativeOption {
  key: string;
  name: string;
  default_rest_sec: number;
}

export interface Workout {
  id: string;
  user_id: string;
  day_of_week: number; // 1=Mon .. 7=Sun
  code: string;
  name: string;
  subtitle: string;
  sort_order: number;
}

export interface Exercise {
  id: string;
  user_id: string;
  workout_id: string;
  exercise_key: string;
  name: string;
  target_sets: number;
  rep_min: number;
  rep_max: number;
  rest_min_sec: number;
  rest_max_sec: number;
  default_rest_sec: number;
  is_compound: number;
  alternatives: AlternativeOption[];
  sort_order: number;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  workout_id: string | null;
  workout_name: string;
  started_at: number;
  completed_at: number | null;
  status: 'in_progress' | 'completed';
  total_volume_kg: number;
}

export interface SessionExercise {
  id: string;
  user_id: string;
  session_id: string;
  workout_exercise_id: string | null;
  original_exercise_key: string;
  original_exercise_name: string;
  performed_exercise_key: string;
  performed_exercise_name: string;
  target_sets: number;
  rep_min: number;
  rep_max: number;
  default_rest_sec: number;
  alternatives: AlternativeOption[];
  sort_order: number;
}

export interface SetLog {
  id: string;
  user_id: string;
  session_id: string;
  session_exercise_id: string;
  exercise_key: string;
  exercise_name: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  rir: number | null;
  planned_rest_sec: number;
  actual_rest_sec: number | null;
  completed: number; // 0 | 1
  completed_at: number | null;
  created_at: number;
}

export type SetLogPatch = Omit<Partial<SetLog>, 'completed'> & {
  completed?: boolean | number;
};

export interface WeightLog {
  id: string;
  user_id: string;
  weight_kg: number;
  recorded_at: number;
  created_at: number;
}

export interface ProgressionInsight {
  hasHistory: boolean;
  lastWeightKg: number;
  summary: string;
  shouldIncrease: boolean;
}

export interface ActiveSessionItem {
  exercise: SessionExercise;
  sets: SetLog[];
}

export interface ActiveSessionPayload {
  session: WorkoutSession;
  items: ActiveSessionItem[];
}

export interface BootstrapPayload {
  hasAdmin: boolean;
  sessionToken?: string;
  user: UserProfile | null;
  workouts: Workout[];
  exercises: Exercise[];
  sessions: WorkoutSession[];
  setLogs: SetLog[];
  weightLogs: WeightLog[];
  activeSession: ActiveSessionPayload | null;
}

export interface RestTimerState {
  setId: string;
  exerciseName: string;
  plannedSec: number;
  startedAtMs: number;
  endAtMs: number;
  isPaused: boolean;
  pausedRemainingSec: number;
}
