import { FormEvent, useState } from 'react';
import type { UserProfile, UserRole, WeightLog } from '../types.ts';
import { formatDate, formatKg, formatShortDate } from '../utils/training.ts';
import { ProgressionLineChart } from './Charts.tsx';
import { ConfirmDialog } from './WorkoutsView.tsx';

interface ProfileViewProps {
  user: UserProfile;
  weightLogs: WeightLog[];
  adminOpen: boolean;
  adminUsers: UserProfile[];
  onLogWeight: (weightKg: number) => Promise<void>;
  onDeleteWeight: (id: string) => Promise<void>;
  onOpenAdmin: () => Promise<void>;
  onCloseAdmin: () => void;
  onAdminCreateUser: (username: string, password: string, role: UserRole) => Promise<void>;
  onAdminToggleBlock: (userId: string, blocked: boolean) => Promise<void>;
  onAdminResetPassword: (userId: string, newPassword: string, confirm: string) => Promise<void>;
  onAdminDeleteUser: (userId: string) => Promise<void>;
  onLogout: () => Promise<void>;
}

export function ProfileView({
  user,
  weightLogs,
  adminOpen,
  adminUsers,
  onLogWeight,
  onDeleteWeight,
  onOpenAdmin,
  onCloseAdmin,
  onAdminCreateUser,
  onAdminToggleBlock,
  onAdminResetPassword,
  onAdminDeleteUser,
  onLogout,
}: ProfileViewProps) {
  const isAdmin = user.role === 'ADMIN';
  const [weightInput, setWeightInput] = useState('');

  if (adminOpen && isAdmin) {
    return (
      <AdminPanel
        currentUserId={user.id}
        users={adminUsers}
        onBack={onCloseAdmin}
        onCreateUser={onAdminCreateUser}
        onToggleBlock={onAdminToggleBlock}
        onResetPassword={onAdminResetPassword}
        onDeleteUser={onAdminDeleteUser}
      />
    );
  }

  const safeWeightLogs = Array.isArray(weightLogs) ? weightLogs : [];
  const weightPoints = safeWeightLogs
    .slice(0, 10)
    .reverse()
    .map((w) => ({ label: formatShortDate(w.recorded_at), value: Number(w.weight_kg) }));

  const handleWeightSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = Number(weightInput.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    await onLogWeight(parsed);
    setWeightInput('');
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#121215] border border-[#27272e] rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-[#9ca3af]">Usuário conectado · {user.role}</p>
            <h2 className="text-xl font-bold text-[#f4f4f5] mt-0.5">@{user.username}</h2>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => void onOpenAdmin()}
              className="min-h-[42px] px-4 bg-[#a3e635] hover:bg-[#bef264] text-[#09090b] font-bold text-xs rounded-xl cursor-pointer whitespace-nowrap"
            >
              Painel Administrativo
            </button>
          )}
        </div>
      </div>

      <div className="bg-[#121215] border border-[#27272e] rounded-2xl p-4">
        <h3 className="text-sm font-bold text-[#f4f4f5] mb-3">Peso Corporal</h3>
        <form onSubmit={handleWeightSubmit} className="flex items-center gap-2 mb-3">
          <input
            type="text"
            inputMode="decimal"
            placeholder="Peso (kg) ex: 78.5"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            required
            className="flex-1 min-h-[44px] bg-[#18181c] border border-[#27272e] focus:border-[#a3e635] rounded-xl px-3.5 py-2 text-sm text-[#f4f4f5] outline-none"
          />
          <button
            type="submit"
            className="min-h-[44px] px-4 bg-[#a3e635] hover:bg-[#bef264] text-[#09090b] font-bold text-sm rounded-xl cursor-pointer shrink-0"
          >
            Registrar
          </button>
        </form>

        <ProgressionLineChart
          points={weightPoints}
          unit="kg"
          emptyText="Registre pelo menos 2 pesos para ver o gráfico."
        />

        {safeWeightLogs.length > 0 && (
          <div className="border-t border-[#27272e] mt-3 pt-2 divide-y divide-[#27272e]/60">
            {safeWeightLogs.slice(0, 8).map((w) => (
              <div key={w.id} className="py-2 flex items-center justify-between text-sm">
                <span>
                  <strong className="font-mono tabular-nums">{formatKg(w.weight_kg)} kg</strong>{' '}
                  <span className="text-xs text-[#9ca3af] font-mono tabular-nums">
                    · {formatDate(w.recorded_at)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void onDeleteWeight(w.id)}
                  className="text-xs font-semibold text-[#fca5a5] hover:underline px-2 py-1 cursor-pointer"
                >
                  Excluir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => void onLogout()}
        className="w-full min-h-[46px] bg-[#ef4444]/15 hover:bg-[#ef4444]/25 border border-[#ef4444]/40 text-[#fca5a5] font-bold text-sm rounded-xl cursor-pointer transition-colors"
      >
        Sair da conta
      </button>
    </div>
  );
}

function AdminPanel({
  currentUserId,
  users = [],
  onBack,
  onCreateUser,
  onToggleBlock,
  onResetPassword,
  onDeleteUser,
}: {
  currentUserId: string;
  users?: UserProfile[];
  onBack: () => void;
  onCreateUser: (username: string, password: string, role: UserRole) => Promise<void>;
  onToggleBlock: (userId: string, blocked: boolean) => Promise<void>;
  onResetPassword: (userId: string, newPassword: string, confirm: string) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
}) {
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('ALUNO');
  const [search, setSearch] = useState('');

  const [resetTarget, setResetTarget] = useState<UserProfile | null>(null);
  const [resetPass, setResetPass] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);

  const safeUsers = Array.isArray(users) ? users : [];
  const filtered = safeUsers.filter((u) => {
    const q = search.trim().toLowerCase();
    return !q || u.username.toLowerCase().includes(q);
  });

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await onCreateUser(newUser, newPass, newRole);
    setNewUser('');
    setNewPass('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2
          className="text-xl font-extrabold tracking-tight text-[#f4f4f5]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Painel Administrativo
        </h2>
        <button
          type="button"
          onClick={onBack}
          className="min-h-[40px] px-3.5 bg-[#18181c] border border-[#27272e] text-xs font-bold text-[#f4f4f5] rounded-xl cursor-pointer"
        >
          Voltar ao Perfil
        </button>
      </div>

      <div className="bg-[#121215] border border-[#27272e] rounded-2xl p-4">
        <h3 className="text-sm font-bold text-[#f4f4f5] mb-3">Criar nova conta</h3>
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[#9ca3af] mb-1">
              Nome de usuário
            </label>
            <input
              type="text"
              autoCapitalize="none"
              placeholder="ex: aluno01"
              value={newUser}
              onChange={(e) => setNewUser(e.target.value)}
              required
              className="w-full min-h-[42px] bg-[#18181c] border border-[#27272e] focus:border-[#a3e635] rounded-xl px-3 py-2 text-sm text-[#f4f4f5] outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#9ca3af] mb-1">
                Senha (mínimo 6 caracteres)
              </label>
              <input
                type="password"
                minLength={6}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                required
                className="w-full min-h-[42px] bg-[#18181c] border border-[#27272e] focus:border-[#a3e635] rounded-xl px-3 py-2 text-sm text-[#f4f4f5] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9ca3af] mb-1">Função</label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-[#18181c] rounded-xl">
                {(['ALUNO', 'ADMIN'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setNewRole(r)}
                    className={`min-h-[34px] rounded-lg text-xs font-bold cursor-pointer ${
                      newRole === r
                        ? 'bg-[#a3e635] text-[#09090b]'
                        : 'text-[#9ca3af] hover:text-[#f4f4f5]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full min-h-[44px] bg-[#a3e635] hover:bg-[#bef264] text-[#09090b] font-bold text-sm rounded-xl cursor-pointer"
          >
            Criar conta de usuário
          </button>
        </form>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[#f4f4f5]">Usuários ({filtered.length})</h3>
        </div>
        <input
          type="text"
          placeholder="Filtrar por nome de usuário..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full min-h-[42px] bg-[#121215] border border-[#27272e] focus:border-[#a3e635] rounded-xl px-3.5 py-2 text-sm text-[#f4f4f5] outline-none"
        />

        {filtered.map((u) => {
          const isSelf = u.id === currentUserId;
          const blocked = u.is_blocked === 1;
          return (
            <div
              key={u.id}
              className="bg-[#121215] border border-[#27272e] rounded-2xl p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-sm text-[#f4f4f5]">
                    @{u.username}
                    {isSelf ? ' (Você)' : ''}
                  </p>
                  <p className="text-xs text-[#9ca3af] font-mono tabular-nums mt-0.5">
                    {u.role} · Criado em {formatDate(u.created_at)}
                    {blocked ? ' · Bloqueado' : ''}
                  </p>
                </div>
              </div>

              {!isSelf && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => void onToggleBlock(u.id, !blocked)}
                    className="min-h-[38px] px-3 bg-[#18181c] hover:bg-[#222228] border border-[#27272e] text-xs font-bold text-[#f4f4f5] rounded-xl cursor-pointer"
                  >
                    {blocked ? 'Desbloquear' : 'Bloquear'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResetPass('');
                      setResetConfirm('');
                      setResetTarget(u);
                    }}
                    className="min-h-[38px] px-3 bg-[#18181c] hover:bg-[#222228] border border-[#27272e] text-xs font-bold text-[#f4f4f5] rounded-xl cursor-pointer"
                  >
                    Redefinir senha
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(u)}
                    className="min-h-[38px] px-3 bg-[#ef4444]/15 hover:bg-[#ef4444]/25 border border-[#ef4444]/40 text-xs font-bold text-[#fca5a5] rounded-xl cursor-pointer"
                  >
                    Excluir
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal redefinir senha */}
      {resetTarget && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setResetTarget(null)}
        >
          <div
            className="w-full max-w-sm bg-[#121215] border border-[#27272e] rounded-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#f4f4f5] mb-3">
              Redefinir senha: @{resetTarget.username}
            </h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await onResetPassword(resetTarget.id, resetPass, resetConfirm);
                setResetTarget(null);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-[#9ca3af] mb-1">
                  Nova senha (mínimo 6 caracteres)
                </label>
                <input
                  type="password"
                  minLength={6}
                  value={resetPass}
                  onChange={(e) => setResetPass(e.target.value)}
                  required
                  className="w-full min-h-[42px] bg-[#18181c] border border-[#27272e] focus:border-[#a3e635] rounded-xl px-3 py-2 text-sm text-[#f4f4f5] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#9ca3af] mb-1">
                  Confirmar nova senha
                </label>
                <input
                  type="password"
                  minLength={6}
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  required
                  className="w-full min-h-[42px] bg-[#18181c] border border-[#27272e] focus:border-[#a3e635] rounded-xl px-3 py-2 text-sm text-[#f4f4f5] outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="min-h-[40px] px-4 bg-[#18181c] border border-[#27272e] text-xs font-bold text-[#9ca3af] rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-4 bg-[#a3e635] text-[#09090b] text-xs font-bold rounded-xl cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Excluir @${deleteTarget.username}?`}
          body="Esta ação remove permanentemente o usuário e todos os seus treinos."
          confirmLabel="Excluir"
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await onDeleteUser(deleteTarget.id);
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
}
