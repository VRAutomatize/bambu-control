import Link from 'next/link';
import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'negative';
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-brand-600'
      : tone === 'negative'
        ? 'text-red-600'
        : 'text-neutral-900 dark:text-neutral-100';
  return (
    <Card>
      <p className="text-sm text-neutral-500" title={hint}>
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-400">{hint}</p>}
    </Card>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <Card className="text-center">
      <p className="font-medium text-neutral-700 dark:text-neutral-200">{title}</p>
      {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
    </Card>
  );
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-brand-100 text-brand-800',
  printing: 'bg-blue-100 text-blue-800',
  pending: 'bg-neutral-100 text-neutral-700',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-amber-100 text-amber-800',
  unknown: 'bg-neutral-100 text-neutral-500',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Concluída',
  printing: 'Imprimindo',
  pending: 'Pendente',
  failed: 'Falhou',
  cancelled: 'Cancelada',
  unknown: 'Desconhecido',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STATUS_STYLES[status] ?? STATUS_STYLES.unknown}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function LinkButton({
  href,
  children,
  variant = 'primary',
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Link href={href} className={variant === 'primary' ? 'btn-primary' : 'btn-secondary'}>
      {children}
    </Link>
  );
}
