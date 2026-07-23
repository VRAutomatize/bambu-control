'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/impressoes', label: 'Impressões', icon: '🖨' },
  { href: '/impressoras', label: 'Impressoras', icon: '⚙' },
  { href: '/filamentos', label: 'Filamentos', icon: '🧵' },
  { href: '/clientes', label: 'Clientes', icon: '👤' },
  { href: '/pedidos', label: 'Pedidos', icon: '📦' },
  { href: '/relatorios', label: 'Relatórios', icon: '📊' },
  { href: '/integracoes', label: 'Integrações', icon: '🔌' },
  { href: '/configuracoes', label: 'Configurações', icon: '⚙️' },
];

export function Sidebar({ orgName, role }: { orgName: string; role: string }) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 md:flex">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
          B
        </div>
        <span className="font-semibold tracking-tight">Bambu Control</span>
      </div>
      <div className="mb-4 rounded-lg bg-neutral-100 px-3 py-2 dark:bg-neutral-800">
        <p className="truncate text-sm font-medium">{orgName}</p>
        <p className="text-xs capitalize text-neutral-500">{role}</p>
      </div>
      <nav className="flex-1 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
              }`}
            >
              <span aria-hidden className="w-5 text-center">
                {item.icon}
              </span>
              {item.label}
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
    <nav className="flex gap-1 overflow-x-auto border-b border-neutral-200 bg-white px-2 py-2 dark:border-neutral-800 dark:bg-neutral-900 md:hidden">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs ${
              active ? 'bg-brand-600 text-white' : 'text-neutral-600 dark:text-neutral-300'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
