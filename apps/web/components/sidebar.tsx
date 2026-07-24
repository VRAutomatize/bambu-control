'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconChart,
  IconDashboard,
  IconPackage,
  IconPlug,
  IconPrinter,
  IconSettings,
  IconSpool,
  IconUsers,
} from './icons';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', Icon: IconDashboard },
  { href: '/impressoes', label: 'Impressões', Icon: IconPrinter },
  { href: '/impressoras', label: 'Impressoras', Icon: IconPrinter },
  { href: '/filamentos', label: 'Filamentos', Icon: IconSpool },
  { href: '/clientes', label: 'Clientes', Icon: IconUsers },
  { href: '/pedidos', label: 'Pedidos', Icon: IconPackage },
  { href: '/relatorios', label: 'Relatórios', Icon: IconChart },
  { href: '/integracoes', label: 'Integrações', Icon: IconPlug },
  { href: '/configuracoes', label: 'Configurações', Icon: IconSettings },
];

export function Sidebar({ orgName, role }: { orgName: string; role: string }) {
  const pathname = usePathname();
  const roleLabel: Record<string, string> = {
    owner: 'Proprietário',
    admin: 'Administrador',
    operator: 'Operador',
    viewer: 'Visualizador',
  };
  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-1 border-r border-black/[0.06] bg-white/70 px-3 py-4 backdrop-blur-xl dark:border-white/[0.07] dark:bg-neutral-950/60 md:flex">
      <div className="mb-5 flex items-center gap-2.5 px-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-gradient-to-b from-brand-400 to-brand-600 text-[13px] font-bold text-white shadow-sm">
          B
        </div>
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-900 dark:text-neutral-50">
          Bambu Control
        </span>
      </div>

      <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-black/[0.03] px-2.5 py-2 dark:bg-white/[0.05]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[12px] font-semibold text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
          {orgName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
            {orgName}
          </p>
          <p className="truncate text-[11.5px] text-neutral-500 dark:text-neutral-400">
            {roleLabel[role] ?? role}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-[2px]">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-2.5 rounded-[9px] px-2.5 py-[7px] text-[13.5px] font-medium transition-colors duration-100 ${
                active
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-neutral-600 hover:bg-black/[0.04] dark:text-neutral-300 dark:hover:bg-white/[0.06]'
              }`}
            >
              <Icon
                width={17}
                height={17}
                strokeWidth={active ? 2 : 1.75}
                className={active ? 'text-white' : 'text-neutral-400 dark:text-neutral-500'}
              />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-black/[0.06] bg-white/80 px-3 py-2 backdrop-blur-xl dark:border-white/[0.07] dark:bg-neutral-950/70 md:hidden">
      {NAV.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              active
                ? 'bg-brand-500 text-white'
                : 'text-neutral-600 hover:bg-black/[0.04] dark:text-neutral-300'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
