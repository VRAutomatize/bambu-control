import { requireCurrentOrg } from '@/lib/auth';
import { Sidebar, MobileNav } from '@/components/sidebar';
import { signOut } from '../(auth)/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { org } = await requireCurrentOrg();

  return (
    <div className="flex min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <Sidebar orgName={org.organizationName} role={org.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
          <span className="text-sm text-neutral-500 md:hidden">{org.organizationName}</span>
          <div className="ml-auto">
            <form action={signOut}>
              <button type="submit" className="btn-secondary text-xs">
                Sair
              </button>
            </form>
          </div>
        </header>
        <MobileNav />
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
