# Segurança e Privacidade

## Multi-tenant e RLS

- Toda tabela de negócio tem `organization_id`.
- **Row Level Security** em todas as tabelas, baseada em `organization_members`.
- Helpers `SECURITY DEFINER` (`user_org_ids`, `user_has_org_role`, `user_can_write`)
  evitam recursão de RLS.
- Papéis: `owner` (tudo + faturamento), `admin` (operação + cadastros + membros),
  `operator` (impressões/filamentos/clientes/pedidos), `viewer` (somente leitura).
- Isolamento **real no banco**, não apenas filtros no front. Validado por
  `supabase/tests/rls_test.sql` (org A ≠ org B, viewer não escreve, operator não
  gerencia membros, snapshots imutáveis).

## Chaves e segredos

| Chave | Onde pode aparecer |
|-------|--------------------|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser e servidor (pública, sujeita a RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Somente** server-side (Route Handlers/Actions/worker). Bypassa RLS. Nunca no bundle do cliente |
| `CREDENTIALS_ENCRYPTION_KEY` | Somente server-side |

- `@bambu/db` expõe `createAdminClient()` apenas para código server. O cliente de
  browser (`lib/supabase/browser.ts`) usa exclusivamente a anon key.

## Credenciais de integração

- Fluxo desejado: usuário inicia conexão → back-end autentica → (se necessário)
  código de verificação → back-end obtém token → **senha original descartada** →
  token armazenado **criptografado** (AES-256-GCM, `encrypted_credentials`).
- Front-end recebe apenas status sanitizado.
- Ao desconectar, `encrypted_credentials` é apagado.
- **Risco documentado**: se a lib/API exigir reter a senha para renovar o token,
  isso **não** deve ser feito silenciosamente — exige decisão explícita. Hoje o
  MVP não retém senha (modo demo não guarda credenciais).

## Logs

Nunca registrar: senha, access/refresh token, código de verificação, chave do
Supabase, payload sensível completo. Logs de sync são estruturados e sanitizados
(`{ level, message, page, attempt, errorCode, connectionId }`).

## Outras proteções

- Autorização server-side em todas as Server Actions (checagem de papel).
- Proteção IDOR: RLS + filtro explícito por `organization_id`; inserts cross-org
  são negados pela policy (testado).
- Headers de segurança + CSP (`next.config.mjs`): X-Frame-Options DENY,
  nosniff, Referrer-Policy, Permissions-Policy.
- Snapshots de custo imutáveis (sem policy de UPDATE/DELETE).
- Auditoria (`audit_logs`) para mudanças financeiras e de conexão.
- Validação de payloads com Zod; CSV com validação e proteção contra CSV
  injection (linhas iniciadas por `= + - @` devem ser neutralizadas na importação).

## Marca

Exibir sempre: *"Integração não oficial e independente. Bambu Control não é
afiliado à Bambu Lab."* Não usar o logotipo oficial. Validar termos de uso,
política de privacidade e possibilidade de uso comercial antes de apresentar a
integração como suportada.
