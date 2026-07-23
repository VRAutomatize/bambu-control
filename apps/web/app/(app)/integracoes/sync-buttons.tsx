'use client';
import { useTransition } from 'react';
import { syncNow, disconnect } from './actions';

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
