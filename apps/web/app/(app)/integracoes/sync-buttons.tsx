'use client';
import { useTransition, useState } from 'react';
import { syncNow, disconnect, verifyBambuCode, resendBambuCode } from './actions';

export function SyncButton({ connectionId }: { connectionId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-primary text-xs"
      disabled={pending}
      onClick={() => start(() => syncNow(connectionId))}
    >
      {pending ? 'Sincronizando…' : 'Sincronizar agora'}
    </button>
  );
}

export function DisconnectButton({ connectionId }: { connectionId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-secondary text-xs"
      disabled={pending}
      onClick={() => {
        if (confirm('Desconectar e apagar credenciais?')) start(() => disconnect(connectionId));
      }}
    >
      Desconectar
    </button>
  );
}

export function VerifyCodeButton({ connectionId }: { connectionId: string }) {
  const [pending, start] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendPending, resendStart] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
      }
    });
  };

  const handleResend = () => {
    const formData = new FormData();
    formData.set('connectionId', connectionId);

    resendStart(async () => {
      const result = await resendBambuCode(null, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
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
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        type="text"
        placeholder="Digite o código de 6 dígitos"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
        maxLength={6}
        className="input text-center text-sm tracking-widest"
        disabled={pending}
        autoFocus
      />
      {error && (
        <p className="text-[11px] text-red-600 dark:text-red-400">
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
        className="w-full text-[11px] text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
        onClick={handleResend}
        disabled={resendPending}
      >
        {resendPending ? 'Reenviando…' : 'Reenviar código'}
      </button>
    </form>
  );
}
