import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bambu Control — ERP para impressão 3D',
  description:
    'ERP simplificado para impressão 3D: custos, filamentos, pedidos e lucratividade real.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
