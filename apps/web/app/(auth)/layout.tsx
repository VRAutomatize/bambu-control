import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f5f7] p-4 dark:bg-black">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background:radial-gradient(60%_50%_at_50%_0%,theme(colors.brand.100),transparent_70%)] dark:[background:radial-gradient(60%_50%_at_50%_0%,theme(colors.brand.900/.25),transparent_70%)]"
      />
      <div className="w-full max-w-[380px]">
        <Link href="/" className="mb-9 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-b from-brand-400 to-brand-600 text-[15px] font-bold text-white shadow-sm">
            B
          </div>
          <span className="text-[17px] font-semibold tracking-[-0.01em] text-neutral-900 dark:text-neutral-50">
            Bambu Control
          </span>
        </Link>
        {children}
        <p className="mt-6 text-center text-[11.5px] leading-relaxed text-neutral-400 dark:text-neutral-500">
          Integração não oficial e independente.
          <br />
          Bambu Control não é afiliado à Bambu Lab.
        </p>
      </div>
    </div>
  );
}
