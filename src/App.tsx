import { useCallback, useEffect, useRef, useState } from 'react';
import { Dumbbell, Home, LineChart, User } from 'lucide-react';
import { api, setUnauthorizedHandler } from './api.ts';
import { AuthView } from './components/AuthView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { ProfileView } from './components/ProfileView.tsx';
import { RestScheduleModal } from './components/RestScheduleModal.tsx';
import { RestTimerBar } from './components/RestTimerBar.tsx';
import { WorkoutsView } from './components/WorkoutsView.tsx';
import type {
  AlternativeOption,
  BootstrapPayload,
  MainTab,
  RestTimerState,
  SetLog,
  SetLogPatch,
  UserProfile,
  UserRole,
} from './types.ts';
import { playRestCompleteAlert, unlockRestAudio } from './utils/training.ts';

const TIMER_KEY = 'ironlog_rest_timer';

function loadTimer(): RestTimerState | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    return raw ? (JSON.parse(raw) as RestTimerState) : null;
  } catch {
    return null;
  }
}

function saveTimer(timer: RestTimerState | null) {
  try {
    if (!timer) localStorage.removeItem(TIMER_KEY);
    else localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
  } catch {
    // Ignore storage errors
  }
}

function computeRemaining(t: RestTimerState | null): number {
  if (!t) return 0;
  if (t.isPaused) return Math.max(0, t.pausedRemainingSec);
  return Math.max(0, Math.ceil((t.endAtMs - Date.now()) / 1000));
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BootstrapPayload>({
    hasAdmin: true,
    user: null,
    workouts: [],
    exercises: [],
    sessions: [],
    setLogs: [],
    weightLogs: [],
    activeSession: null,
  });

  const [tab, setTab] = useState<MainTab>('inicio');
  const [historySessionId, setHistorySessionId] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error: boolean } | null>(null);

  const [timer, setTimer] = useState<RestTimerState | null>(() => loadTimer());
  const [timerRemaining, setTimerRemaining] = useState<number>(() =>
    computeRemaining(loadTimer())
  );
  const finishingTimerRef = useRef(false);

  const notify = useCallback((msg: string, error = false) => {
    setToast({ msg, error });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const refreshBootstrap = useCallback(async () => {
    const res = await api.bootstrap();
    setData(res);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      saveTimer(null);
      setTimer(null);
      setAdminOpen(false);
      setAdminUsers([]);
      setData((prev) => ({
        ...prev,
        user: null,
        workouts: [],
        exercises: [],
        sessions: [],
        setLogs: [],
        weightLogs: [],
        activeSession: null,
      }));
    });
  }, []);

  useEffect(() => {
    refreshBootstrap()
      .catch((err) => {
        notify(err instanceof Error ? err.message : 'Erro ao conectar com o servidor.', true);
      })
      .finally(() => setLoading(false));
  }, [refreshBootstrap, notify]);

  // ===========================================================================
  // REST TIMER LOOP (resilient to screen lock via absolute timestamps)
  // ===========================================================================
  const completeTimer = useCallback(
    async (skipped: boolean) => {
      const cur = loadTimer();
      if (!cur || finishingTimerRef.current) return;
      finishingTimerRef.current = true;
      try {
        const elapsed = cur.isPaused
          ? Math.max(0, cur.plannedSec - cur.pausedRemainingSec)
          : Math.round((Date.now() - cur.startedAtMs) / 1000);
        const actual = skipped ? elapsed : Math.max(cur.plannedSec, elapsed);

        saveTimer(null);
        setTimer(null);
        setTimerRemaining(0);

        if (!skipped) {
          playRestCompleteAlert();
        }

        if (data.user) {
          await api.updateSet(cur.setId, { actual_rest_sec: actual }).catch(() => {});
          await refreshBootstrap().catch(() => {});
        }
      } finally {
        finishingTimerRef.current = false;
      }
    },
    [data.user, refreshBootstrap]
  );

  useEffect(() => {
    if (!timer || timer.isPaused) return;

    const tick = () => {
      const rem = computeRemaining(timer);
      setTimerRemaining(rem);
      if (rem <= 0) {
        void completeTimer(false);
      }
    };

    tick();
    const id = setInterval(tick, 250);
    const onWake = () => tick();
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [timer, completeTimer]);

  const startRestTimer = (setId: string, exerciseName: string, plannedSec: number) => {
    unlockRestAudio();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    const now = Date.now();
    const safePlanned = Math.min(600, Math.max(10, plannedSec));
    const next: RestTimerState = {
      setId,
      exerciseName,
      plannedSec: safePlanned,
      startedAtMs: now,
      endAtMs: now + safePlanned * 1000,
      isPaused: false,
      pausedRemainingSec: safePlanned,
    };
    saveTimer(next);
    setTimer(next);
    setTimerRemaining(safePlanned);
  };

  const togglePauseTimer = () => {
    if (!timer) return;
    const next: RestTimerState = timer.isPaused
      ? {
          ...timer,
          isPaused: false,
          endAtMs: Date.now() + timer.pausedRemainingSec * 1000,
        }
      : {
          ...timer,
          isPaused: true,
          pausedRemainingSec: computeRemaining(timer),
        };
    saveTimer(next);
    setTimer(next);
    setTimerRemaining(computeRemaining(next));
  };

  const restartTimer = () => {
    if (!timer) return;
    const now = Date.now();
    const next: RestTimerState = {
      ...timer,
      startedAtMs: now,
      endAtMs: now + timer.plannedSec * 1000,
      isPaused: false,
      pausedRemainingSec: timer.plannedSec,
    };
    saveTimer(next);
    setTimer(next);
    setTimerRemaining(timer.plannedSec);
  };

  const adjustTimer = (deltaSec: number) => {
    if (!timer) return;
    const next: RestTimerState = timer.isPaused
      ? { ...timer, pausedRemainingSec: Math.max(5, timer.pausedRemainingSec + deltaSec) }
      : {
          ...timer,
          endAtMs: Date.now() + Math.max(5, computeRemaining(timer) + deltaSec) * 1000,
        };
    saveTimer(next);
    setTimer(next);
    setTimerRemaining(computeRemaining(next));
  };

  // ===========================================================================
  // AUTH ACTIONS
  // ===========================================================================
  const handleClaimAdmin = async (u: string, p: string, c: string) => {
    try {
      const res = await api.claimAdmin(u, p, c);
      setData(res);
      notify('Conta ADMIN configurada!');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao criar ADMIN.', true);
    }
  };

  const handleLogin = async (u: string, p: string) => {
    try {
      const res = await api.login(u, p);
      setData(res);
      setTab('inicio');
      setAdminOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao entrar.', true);
    }
  };

  const handleRegister = async (u: string, p: string, c: string) => {
    try {
      const res = await api.register(u, p, c);
      setData(res);
      setTab('inicio');
      notify('Conta criada com sucesso!');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao cadastrar.', true);
    }
  };

  const handleLogout = async () => {
    saveTimer(null);
    setTimer(null);
    await api.logout().catch(() => {});
    setAdminOpen(false);
    setAdminUsers([]);
    await refreshBootstrap();
  };

  // ===========================================================================
  // TRAINING ACTIONS
  // ===========================================================================
  const handleSaveSchedule = async (
    assignments: Array<{ workoutId: string; dayOfWeek: number }>
  ) => {
    try {
      const res = await api.updateWorkoutSchedule(assignments);
      setData(res);
      notify('Escala de treinos atualizada!');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao atualizar escala.', true);
      throw err;
    }
  };

  const handleStartWorkout = async (workoutId: string) => {
    try {
      const res = await api.startWorkout(workoutId);
      setData(res);
      setTab('treinos');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao iniciar treino.', true);
    }
  };

  const handleUpdateSet = async (setId: string, patch: SetLogPatch) => {
    try {
      const { set: updated } = await api.updateSet(setId, patch);
      setData((prev) => {
        const nextSetLogs = prev.setLogs.map((s) => (s.id === setId ? updated : s));
        const nextActive = prev.activeSession
          ? {
              ...prev.activeSession,
              items: prev.activeSession.items.map((it) => ({
                ...it,
                sets: it.sets.map((s) => (s.id === setId ? updated : s)),
              })),
            }
          : null;
        return { ...prev, setLogs: nextSetLogs, activeSession: nextActive };
      });
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao salvar série.', true);
    }
  };

  const handleToggleSetDone = async (setLog: SetLog) => {
    const nextDone = setLog.completed !== 1;
    await handleUpdateSet(setLog.id, { completed: nextDone });
    if (nextDone) {
      startRestTimer(setLog.id, setLog.exercise_name, setLog.planned_rest_sec || 90);
    }
  };

  const handleAddSet = async (sessionExerciseId: string) => {
    try {
      const res = await api.addSet(sessionExerciseId);
      setData(res);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao adicionar série.', true);
    }
  };

  const handleDeleteSet = async (setId: string) => {
    try {
      const res = await api.deleteSet(setId);
      setData(res);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao remover série.', true);
    }
  };

  const handleSubstituteExercise = async (
    sessionExerciseId: string,
    option: AlternativeOption,
    updateAllSets = false
  ) => {
    try {
      const res = await api.substituteExercise(sessionExerciseId, {
        ...option,
        updateAllSets,
      });
      setData(res);
      notify(`Alterado para ${option.name}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao substituir.', true);
    }
  };

  const handleFinishSession = async (sessionId: string) => {
    try {
      if (timer) await completeTimer(true);
      const res = await api.finishSession(sessionId);
      setData(res);
      setTab('historico');
      notify('Treino finalizado!');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao finalizar treino.', true);
    }
  };

  const handleDiscardSession = async (sessionId: string) => {
    try {
      saveTimer(null);
      setTimer(null);
      const res = await api.discardSession(sessionId);
      setData(res);
      notify('Treino descartado.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao descartar treino.', true);
    }
  };

  // ===========================================================================
  // WEIGHT & ADMIN ACTIONS
  // ===========================================================================
  const handleLogWeight = async (weightKg: number) => {
    try {
      const res = await api.logWeight(weightKg);
      setData(res);
      notify('Peso registrado.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao registrar peso.', true);
    }
  };

  const handleDeleteWeight = async (id: string) => {
    try {
      const res = await api.deleteWeight(id);
      setData(res);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao excluir registro.', true);
    }
  };

  const handleOpenAdmin = async () => {
    try {
      const res = await api.adminListUsers();
      setAdminUsers(Array.isArray(res?.users) ? res.users : []);
      setAdminOpen(true);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Acesso negado.', true);
    }
  };

  const handleAdminCreateUser = async (username: string, password: string, role: UserRole) => {
    try {
      const res = await api.adminCreateUser(username, password, role);
      if (Array.isArray(res?.users)) {
        setAdminUsers(res.users);
      }
      const clean = username.trim().toLowerCase();
      notify(`Conta ${clean.includes('@') ? clean : `@${clean}`} criada!`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao criar usuário.', true);
    }
  };

  const handleAdminToggleBlock = async (userId: string, blocked: boolean) => {
    try {
      const res = await api.adminToggleBlock(userId, blocked);
      if (Array.isArray(res?.users)) {
        setAdminUsers(res.users);
      }
      notify(blocked ? 'Usuário bloqueado.' : 'Usuário desbloqueado.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao atualizar status.', true);
    }
  };

  const handleAdminResetPassword = async (
    userId: string,
    newPassword: string,
    confirmPassword: string
  ) => {
    try {
      await api.adminResetPassword(userId, newPassword, confirmPassword);
      notify('Senha redefinida com sucesso.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao redefinir senha.', true);
    }
  };

  const handleAdminDeleteUser = async (userId: string) => {
    try {
      const res = await api.adminDeleteUser(userId);
      if (Array.isArray(res?.users)) {
        setAdminUsers(res.users);
      }
      notify('Usuário excluído.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao excluir usuário.', true);
    }
  };

  const navItems: Array<{ id: MainTab; label: string; Icon: typeof Home }> = [
    { id: 'inicio', label: 'Início', Icon: Home },
    { id: 'treinos', label: 'Treinos', Icon: Dumbbell },
    { id: 'historico', label: 'Histórico', Icon: LineChart },
    { id: 'perfil', label: 'Perfil', Icon: User },
  ];

  return (
    <div className="min-h-dvh bg-[#09090b] text-[#f4f4f5]">
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-xs font-bold border shadow-2xl max-w-[90vw] text-center ${
            toast.error
              ? 'bg-[#18181c] border-[#ef4444] text-[#fca5a5]'
              : 'bg-[#18181c] border-[#a3e635] text-[#f4f4f5]'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {loading ? (
        <div className="min-h-dvh flex items-center justify-center text-sm text-[#9ca3af]">
          Carregando FÉ &amp; FERRO...
        </div>
      ) : !data.user ? (
        <AuthView
          hasAdmin={data.hasAdmin}
          onClaimAdmin={handleClaimAdmin}
          onLogin={handleLogin}
          onRegister={handleRegister}
        />
      ) : (
        <>
          {/* Header: Mobile compact top bar / Desktop 3-zone top bar */}
          <header className="sticky top-0 z-30 h-[56px] lg:h-[64px] bg-[#09090b]/90 backdrop-blur-md border-b border-[#27272e]">
            <div className="max-w-5xl mx-auto h-full px-4 flex items-center justify-between gap-8">
              <div className="flex flex-col leading-none shrink-0">
                <span
                  className="text-xl font-extrabold tracking-wider text-[#f4f4f5] whitespace-nowrap"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  FÉ &amp; FERRO
                </span>
                <span className="text-[9px] font-bold tracking-[0.14em] text-[#a3e635] whitespace-nowrap mt-0.5">
                  TREINE COM PROPÓSITO.
                </span>
              </div>

              <nav className="hidden lg:flex items-center gap-6">
                {navItems.map((item) => {
                  const active = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTab(item.id);
                        setAdminOpen(false);
                      }}
                      className={`text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 border-b-2 ${
                        active
                          ? 'text-[#a3e635] border-[#a3e635]'
                          : 'text-[#9ca3af] hover:text-[#f4f4f5] border-transparent'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </nav>

              <div className="flex items-center gap-3 shrink-0 min-w-0">
                <span className="text-xs font-mono text-[#9ca3af] truncate max-w-[180px] sm:max-w-[260px]">
                  {data.user.username.includes('@') ? data.user.username : `@${data.user.username}`}
                  {data.user.role === 'ADMIN' ? ' · ADMIN' : ''}
                </span>
              </div>
            </div>
          </header>

          <main
            className={`max-w-5xl mx-auto px-4 pt-4 ${
              timer ? 'pb-52 lg:pb-24' : 'pb-24 lg:pb-12'
            }`}
          >
            {tab === 'inicio' && (
              <DashboardView
                workouts={data.workouts}
                sessions={data.sessions}
                activeSession={data.activeSession}
                onResumeActive={() => setTab('treinos')}
                onStartWorkout={(wkId) => void handleStartWorkout(wkId)}
                onOpenSessionDetail={(sid) => {
                  setHistorySessionId(sid);
                  setTab('historico');
                }}
                onOpenScheduleConfig={() => setScheduleOpen(true)}
              />
            )}

            {tab === 'treinos' && (
              <WorkoutsView
                workouts={data.workouts}
                exercises={data.exercises}
                sessions={data.sessions}
                setLogs={data.setLogs}
                activeSession={data.activeSession}
                activeTimer={timer}
                timerRemainingSec={timerRemaining}
                onStartWorkout={(wkId) => void handleStartWorkout(wkId)}
                onOpenScheduleConfig={() => setScheduleOpen(true)}
                onStartTimer={(setLog, plannedSec) =>
                  startRestTimer(setLog.id, setLog.exercise_name, plannedSec)
                }
                onTogglePauseTimer={togglePauseTimer}
                onRestartTimer={restartTimer}
                onSkipTimer={() => void completeTimer(true)}
                onUpdateSet={handleUpdateSet}
                onToggleSetDone={handleToggleSetDone}
                onAddSet={handleAddSet}
                onDeleteSet={handleDeleteSet}
                onSubstituteExercise={(seId, opt) => handleSubstituteExercise(seId, opt, false)}
                onFinishSession={handleFinishSession}
                onDiscardSession={handleDiscardSession}
              />
            )}

            {tab === 'historico' && (
              <HistoryView
                sessions={data.sessions}
                setLogs={data.setLogs}
                selectedSessionId={historySessionId}
                onSelectSession={setHistorySessionId}
                onUpdateSet={handleUpdateSet}
                onToggleSetDone={handleToggleSetDone}
                onSubstituteHistoricalExercise={(seId, opt) =>
                  handleSubstituteExercise(seId, opt, true)
                }
              />
            )}

            {tab === 'perfil' && (
              <ProfileView
                user={data.user}
                weightLogs={data.weightLogs}
                adminOpen={adminOpen}
                adminUsers={adminUsers}
                onLogWeight={handleLogWeight}
                onDeleteWeight={handleDeleteWeight}
                onOpenAdmin={handleOpenAdmin}
                onCloseAdmin={() => setAdminOpen(false)}
                onAdminCreateUser={handleAdminCreateUser}
                onAdminToggleBlock={handleAdminToggleBlock}
                onAdminResetPassword={handleAdminResetPassword}
                onAdminDeleteUser={handleAdminDeleteUser}
                onLogout={handleLogout}
              />
            )}
          </main>

          {scheduleOpen && (
            <RestScheduleModal
              workouts={data.workouts}
              onClose={() => setScheduleOpen(false)}
              onSave={handleSaveSchedule}
            />
          )}

          {timer && (
            <RestTimerBar
              timer={timer}
              remainingSec={timerRemaining}
              onTogglePause={togglePauseTimer}
              onRestart={restartTimer}
              onSkip={() => void completeTimer(true)}
              onAdjust={adjustTimer}
            />
          )}

          {/* Mobile Bottom Navigation */}
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#0c0c0f]/95 backdrop-blur-md border-t border-[#27272e]">
            <div className="grid grid-cols-4 h-full max-w-lg mx-auto">
              {navItems.map((item) => {
                const active = tab === item.id;
                const Icon = item.Icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTab(item.id);
                      setAdminOpen(false);
                    }}
                    className={`flex flex-col items-center justify-center gap-1 min-h-[44px] cursor-pointer transition-colors ${
                      active ? 'text-[#a3e635]' : 'text-[#9ca3af] hover:text-[#f4f4f5]'
                    }`}
                  >
                    <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 1.9} />
                    <span className="text-[11px] font-bold tracking-tight whitespace-nowrap">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
