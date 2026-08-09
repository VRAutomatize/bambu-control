/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOTA: NÃO usar output: 'standalone' aqui — o deploy roda via `next start`
  // (Railway/Nixpacks, sem Dockerfile custom rodando .next/standalone/server.js).
  // "next start" é incompatível com output standalone: o manifest de Server
  // Actions fica quebrado e todo signIn/signUp falha no browser com
  // "An unexpected response was received from the server" (validado em
  // produção — ver aviso "next start does not work with output: standalone").
  reactStrictMode: true,
  transpilePackages: ['@bambu/domain', '@bambu/providers', '@bambu/contracts', '@bambu/db'],
  experimental: {
    // Server Actions habilitadas por padrão no Next 15.
  },
  webpack(config) {
    // Os pacotes internos usam imports ESM com extensão `.js` apontando para
    // arquivos `.ts` (fonte). Ensina o webpack a resolver `.js` → `.ts`.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
  async headers() {
    // Headers de segurança básicos.
    const csp = [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
    ].join('; ');
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
