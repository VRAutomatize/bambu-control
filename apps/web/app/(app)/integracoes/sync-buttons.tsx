'use client';
import { useTransition, useState } from 'react';
import { syncNow, disconnect, verifyBambuCode, resendBambuCode } from './actions';

export function SyncButton({ connectionId }: { connectionId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-[11px] text-red-600 dark:text-red-400">{error}</span>}
      <button
        className="btn-primary text-xs"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            try {
              await syncNow(connectionId);
            } catch {
              setError('Falha ao sincronizar.');
            }
          });
        }}
      >
        {pending ? 'Sincronizando…' : 'Sincronizar agora'}
      </button>
    </span>
  );
}

export function DisconnectButton({ connectionId }: { connectionId: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className="text-neutral-500 dark:text-neutral-400">Desconectar e apagar credenciais?</span>
        <button
          className="font-medium text-red-600 hover:text-red-700 dark:text-red-400"
          disabled={pending}
          onClick={() => {
            setError(null);
            start(async () => {
              try {
                await disconnect(connectionId);
              } catch {
                setError('Falha ao desconectar.');
              } finally {
                setConfirming(false);
              }
            });
          }}
        >
          {pending ? 'Desconectando…' : 'Sim, desconectar'}
        </button>
        <button
          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Cancelar
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-[11px] text-red-600 dark:text-red-400">{error}</span>}
      <button className="btn-secondary text-xs" onClick={() => setConfirming(true)}>
        Desconectar
      </button>
    </span>
  );
}

export function VerifyCodeButton({ connectionId }: { connectionId: string }) {
  const [pending, start] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendPending, resendStart] = useTransition();
  const [lastResendTime, setLastResendTime] = useState<number | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Cooldown: 60 segundos entre reenvios
  const canResend = !lastResendTime || Date.now() - lastResendTime > 60000;
  const resendWaitSeconds = canResend ? 0 : Math.ceil((60000 - (Date.now() - lastResendTime)) / 1000);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (code.length !== 6) {
      setError('Código deve ter 6 caracteres.');
      return;
    }

    const formData = new FormData();
    formData.set('connectionId', connectionId);
    formData.set('code', code);

    start(async () => {
      const result = await verifyBambuCode(null, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setShowForm(false);
        setCode('');
        setError(null);
      }
    });
  };

  const handleResend = () => {
    if (!canResend) return;

    const formData = new FormData();
    formData.set('connectionId', connectionId);

    resendStart(async () => {
      const result = await resendBambuCode(null, formData);
      setLastResendTime(Date.now());
      setResendCountdown(60);

      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        // Start countdown
        const interval = setInterval(() => {
          setResendCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    });
  };

  if (!showForm) {
    return (
      <button
        className="btn-primary w-full text-xs"
        onClick={() => setShowForm(true)}
        disabled={pending}
      >
        {pending ? 'Verificando…' : 'Inserir código'}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text"
        placeholder="Ex.: A1B2C3"
        aria-label="Código de verificação de 6 caracteres"
        value={code}
        onChange={(e) => {
          const val = e.target.value.toUpperCase();
          if (/^[A-Z0-9]*$/.test(val)) {
            setCode(val.slice(0, 6));
          }
        }}
        maxLength={6}
        className="input text-center text-sm font-medium tracking-widest"
        disabled={pending}
        autoFocus
      />

      {error && (
        <p className="text-[11px] text-red-600 dark:text-red-400 px-0.5">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          className="btn-primary flex-1 text-xs"
          disabled={pending || code.length !== 6}
        >
          {pending ? 'Verificando…' : 'Verificar'}
        </button>
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() => {
            setShowForm(false);
            setError(null);
            setCode('');
          }}
          disabled={pending}
        >
          Cancelar
        </button>
      </div>

      <button
        type="button"
        className="w-full text-[11px] font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        onClick={handleResend}
        disabled={resendPending || !canResend}
      >
        {resendCountdown > 0
          ? `Reenviar em ${resendCountdown}s`
          : resendPending
            ? 'Reenviando…'
            : 'Reenviar código'}
      </button>
    </form>
  );
}
