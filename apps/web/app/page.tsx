import { redirect } from 'next/navigation';

export default function Home() {
  // O middleware cuida de autenticação; usuários logados vão ao dashboard.
  redirect('/dashboard');
}
