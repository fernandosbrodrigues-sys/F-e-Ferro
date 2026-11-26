import { FormEvent, useState } from 'react';
import { Dumbbell } from 'lucide-react';

interface AuthViewProps {
  hasAdmin: boolean;
  onClaimAdmin: (username: string, password: string, confirm: string) => Promise<void>;
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (username: string, password: string, confirm: string) => Promise<void>;
}

export function AuthView({ hasAdmin, onClaimAdmin, onLogin, onRegister }: AuthViewProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);

  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminConfirm, setAdminConfirm] = useState('');

  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [regUser, setRegUser] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirm, setRegConfirm] = useState('');

  const handleClaim = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onClaimAdmin(adminUser, adminPass, adminConfirm);
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onLogin(loginUser, loginPass);
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onRegister(regUser, regPass, regConfirm);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col justify-center px-4 py-8 max-w-md mx-auto">
      <div className="text-center mb-7">
        <div className="inline-flex items-center justify-center gap-2.5">
          <Dumbbell className="w-7 h-7 text-[#a3e635]" strokeWidth={2.4} />
          <h1
            className="text-3xl font-extrabold tracking-wider text-[#f4f4f5]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            IRON LOG
          </h1>
        </div>
        <p className="text-xs text-[#9ca3af] mt-1 tracking-wide">
          Diário de Treinamento · Hipertrofia
        </p>
      </div>

      {!hasAdmin ? (
        <div className="bg-[#121215] border border-[#a3e635]/40 rounded-2xl p-5">
          <p className="text-xs font-semibold text-[#a3e635] mb-1">Configuração inicial</p>
          <h2 className="text-lg font-bold text-[#f4f4f5]">Criar conta ADMIN principal</h2>
          <p className="text-sm text-[#9ca3af] mt-1 mb-4">
            Defina seu usuário e senha de administrador. Esta conta gerencia os alunos e também registra seus próprios treinos.
          </p>

          <form onSubmit={handleClaim} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#9ca3af] mb-1.5">
                Nome de usuário ADMIN (a-z, 0-9, . _ -)
              </label>
              <input
                type="text"
                autoCapitalize="none"
                autoComplete="username"
                placeholder="ex: admin"
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
                required
                className="w-full min-h-[44px] bg-[#18181c] border border-[#27272e] focus:border-[#a3e635] rounded-xl px-3.5 py-2.5 text-sm text-[#f4f4f5] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9ca3af] mb-1.5">
                Senha (mínimo 6 caracteres)
              </label>
              <input
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                required
                className="w-full min-h-[44px] bg-[#18181c] border border-[#27272e] focus:border-[#a3e635] rounded-xl px-3.5 py-2.5 text-sm text-[#f4f4f5] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9ca3af] mb-1.5">
                Confirmar senha
              </label>
              <input
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={adminConfirm}
                onChange={(e) => setAdminConfirm(e.target.value)}
                required
                className="w-full min-h-[44px] bg-[#18181c] border border-[#27272e] focus:border-[#a3e635] rounded-xl px-3.5 py-2.5 text-sm text-[#f4f4f5] outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[46px] bg-[#a3e635] hover:bg-[#bef264] disabled:opacity-50 text-[#09090b] font-bold text-sm rounded-xl transition-colors cursor-pointer"
            >
              {busy ? 'Criando...' : 'Criar conta ADMIN'}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-[#121215] border border-[#27272e] rounded-2xl p-5">
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#18181c] rounded-xl mb-5">
            <button
              type="button"
              onClick={() => setTab('login')}
              className={`min-h-[40px] rounded-lg text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'login'
                  ? 'bg-[#a3e635] text-[#09090b]'
                  : 'text-[#9ca3af] hover:text-[#f4f4f5]'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setTab('register')}
              className={`min-h-[40px] rounded-lg text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'register'
                  ? 'bg-[#a3e635] text-[#09090b]'
                  : 'text-[#9ca3af] hover:text-[#f4f4f5]'
              }`}
            >
              Cadastrar
            </button>
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#9ca3af] mb-1.5">
                  Nome de usuário
                </label>
                <input
                  type="text"
                  autoCapitalize="none"
                  autoComplete="username"
                  placeholder="ex: joao.silva"
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  required
                  className="w-full min-h-[44px] bg-[#18181c] border border-[#27272e] focus:border-[#a3e635] rounded-xl px-3.5 py-2.5 text-sm text-[#f4f4f5] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9ca3af] mb-1.5">
                  Senha
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  required
                  className="w-full min-h-[44px] bg-[#18181c] border border-[#27272e] focus:border-[#a3e635] rounded-xl px-3.5 py-2.5 text-sm text-[#f4f4f5] outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[46px] bg-[#a3e635] hover:bg-[#bef264] disabled:opacity-50 text-[#09090b] font-bold text-sm rounded-xl transition-colors cursor-pointer"
              >
                {busy ? 'Entrando...' : 'Entrar'}
              </button>

              <p className="text-xs text-[#9ca3af] text-center pt-1">
                Esqueceu a senha? Solicite a redefinição ao administrador.
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#9ca3af] mb-1.5">
                  Nome de usuário único (a-z, 0-9, . _ -)
                </label>
                <input
                  type="text"
                  autoCapitalize="none"
                  autoComplete="username"
                  placeholder="ex: maria_fit"
                  value={regUser}
                  onChange={(e) => setRegUser(e.target.value)}
                  required
                  className="w-full min-h-[44px] bg-[#18181c] border border-[#27272e] focus:border-[#a3e635] rounded-xl px-3.5 py-2.5 text-sm text-[#f4f4f5] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9ca3af] mb-1.5">
                  Senha (mínimo 6 caracteres)
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={regPass}
                  onChange={(e) => setRegPass(e.target.value)}
                  required
                  className="w-full min-h-[44px] bg-[#18181c] border border-[#27272e] focus:border-[#a3e635] rounded-xl px-3.5 py-2.5 text-sm text-[#f4f4f5] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9ca3af] mb-1.5">
                  Confirmar senha
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)}
                  required
                  className="w-full min-h-[44px] bg-[#18181c] border border-[#27272e] focus:border-[#a3e635] rounded-xl px-3.5 py-2.5 text-sm text-[#f4f4f5] outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[46px] bg-[#a3e635] hover:bg-[#bef264] disabled:opacity-50 text-[#09090b] font-bold text-sm rounded-xl transition-colors cursor-pointer"
              >
                {busy ? 'Criando...' : 'Criar conta'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
