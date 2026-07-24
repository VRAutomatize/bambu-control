import { requireCurrentOrg } from '@/lib/auth';
import { Sidebar, MobileNav } from '@/components/sidebar';
import { IconLogout } from '@/components/icons';
import { signOut } from '../(auth)/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { org } = await requireCurrentOrg();

  return (
    <div className="flex min-h-screen bg-[#f5f5f7] dark:bg-black">
      <Sidebar orgName={org.organizationName} role={org.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/[0.06] bg-white/70 px-4 py-2.5 backdrop-blur-xl dark:border-white/[0.07] dark:bg-black/60 md:px-8">
          <span className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400 md:hidden">
            {org.organizationName}
          </span>
          <div className="ml-auto">
            <form action={signOut}>
              <button type="submit" className="btn-ghost text-[13px]">
                <IconLogout width={15} height={15} />
                Sair
              </button>
            </form>
          </div>
        </header>
        <MobileNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
