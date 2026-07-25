import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  IconAlertTriangle,
  IconCheckCircle,
  IconClock,
  IconInbox,
  IconPlus,
} from './icons';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

/** Bloco cinza pulsante — base para skeletons de loading.tsx. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-neutral-200/70 dark:bg-white/[0.06] ${className}`} />;
}

/** Skeleton de página padrão: título + N cards (grid) ou 1 tabela. Cobre a
 * maioria das telas do app sem precisar desenhar um skeleton por rota. */
export function SkeletonPage({
  cards = 3,
  table = false,
}: {
  cards?: number;
  table?: boolean;
}) {
  return (
    <div>
      <div className="mb-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      {table ? (
        <Card className="overflow-hidden p-0">
          <div className="space-y-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-black/[0.04] px-4 py-3.5 last:border-0 dark:border-white/[0.05]">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/6" />
                <Skeleton className="h-4 w-1/6" />
                <Skeleton className="h-4 w-1/6" />
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: cards }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-7 w-32" />
              <Skeleton className="mt-2 h-3 w-20" />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
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
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-neutral-900 dark:text-neutral-50">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[15px] text-neutral-500 dark:text-neutral-400">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

const TONE_STYLES: Record<string, string> = {
  default: 'text-neutral-900 dark:text-neutral-50',
  positive: 'text-brand-600 dark:text-brand-400',
  negative: 'text-red-500',
};

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
  return (
    <Card className="flex flex-col gap-1.5">
      <p className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400" title={hint}>
        {label}
      </p>
      <p className={`text-[26px] font-semibold tracking-[-0.02em] ${TONE_STYLES[tone]}`}>
        {value}
      </p>
      {hint && <p className="text-[12px] text-neutral-400 dark:text-neutral-500">{hint}</p>}
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 dark:bg-white/5 dark:text-neutral-500">
        <IconInbox width={22} height={22} />
      </div>
      <div>
        <p className="font-medium text-neutral-800 dark:text-neutral-100">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-neutral-500 dark:text-neutral-400">
            {description}
          </p>
        )}
      </div>
      {action}
    </Card>
  );
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400',
  printing: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  pending: 'bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300',
  failed: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400',
  cancelled: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  unknown: 'bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-neutral-400',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Concluída',
  printing: 'Imprimindo',
  pending: 'Pendente',
  failed: 'Falhou',
  cancelled: 'Cancelada',
  unknown: 'Desconhecido',
};

const STATUS_DOT: Record<string, string> = {
  completed: 'bg-brand-500',
  printing: 'bg-blue-500',
  pending: 'bg-neutral-400',
  failed: 'bg-red-500',
  cancelled: 'bg-amber-500',
  unknown: 'bg-neutral-400',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STATUS_STYLES[status] ?? STATUS_STYLES.unknown}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status] ?? STATUS_DOT.unknown}`} />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function LinkButton({
  href,
  children,
  variant = 'primary',
  icon,
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  icon?: 'plus';
}) {
  return (
    <Link href={href} className={variant === 'primary' ? 'btn-primary' : 'btn-secondary'}>
      {icon === 'plus' && <IconPlus width={15} height={15} strokeWidth={2} />}
      {children}
    </Link>
  );
}

export function InlineAlert({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warning' | 'success';
  children: ReactNode;
}) {
  const styles = {
    info: 'bg-blue-50 text-blue-800 dark:bg-blue-500/10 dark:text-blue-300',
    warning: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
    success: 'bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-300',
  }[tone];
  const Icon = tone === 'warning' ? IconAlertTriangle : tone === 'success' ? IconCheckCircle : IconClock;
  return (
    <div className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${styles}`}>
      <Icon width={16} height={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function Divider() {
  return <div className="hairline" />;
}
