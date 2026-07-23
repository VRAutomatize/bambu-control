import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4 dark:bg-neutral-950">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
            B
          </div>
          <span className="text-xl font-semibold tracking-tight">Bambu Control</span>
        </Link>
        {children}
        <p className="mt-6 text-center text-xs text-neutral-400">
          Integração não oficial e independente. Bambu Control não é afiliado à Bambu Lab.
        </p>
      </div>
    </div>
  );
}
