# Arquitetura

## Visão geral

```text
Navegador (React 19 + TanStack Router)
   |  supabase-js (chave pública + sessão do usuário)
   |---------------------------> PostgreSQL (RLS + funções SECURITY DEFINER)
   |  server functions (createServerFn)
   |---------------------------> Servidor TanStack Start (Edge / Cloudflare Workers via nitro)
                                     |  cliente admin (service role), só no servidor
                                     +----------> Autenticação + PostgreSQL
```

- **Front-end:** TanStack Start com roteamento por arquivo em `src/routes/`. Layout raiz em `src/routes/__root.tsx`.
- **Back-end:** a maior parte das regras está no próprio banco (políticas RLS, gatilhos e funções em `drizzle/migrations/`). Lógica que exige privilégio de administrador da autenticação (criar usuários, enviar convites) fica em server functions em `src/lib/team.functions.ts`.
- **Deploy:** build Vite com preset nitro para Cloudflare (`vite.config.ts`, `@lovable.dev/vite-tanstack-config`).

## Fluxo de dados

1. **Inscrição pública:** `RegistrationForm.tsx` valida com zod no navegador e chama `supabase.rpc("register_for_event")`. O banco revalida tudo, aplica limite por IP, trava o evento e grava `participants`, `registrations` e `consents`. Retorna o código; o navegador navega para a confirmação.
2. **Confirmação:** `eventos.$slug.confirmacao.$codigo.tsx` (`ssr: false`) chama `get_registration_confirmation`, que devolve só nome, alimento, código, status e slug.
3. **Área da equipe:** `src/routes/_authenticated/route.tsx` (`ssr: false`) chama `supabase.auth.getUser()` no `beforeLoad` e redireciona para `/auth` sem sessão. As leituras usam o cliente do navegador com RLS.
4. **Check-in:** `checkin.tsx` busca em `registrations` (RLS: só equipe) e confirma com `supabase.rpc("confirm_checkin")`.
5. **Convites:** `admin.usuarios.tsx` chama `inviteStaff`/`getInviteLink` (server functions com `requireSupabaseAuth` + `assertAdmin`). `convite.$token.tsx` chama `checkInviteToken` e `acceptInviteToken` (públicas, validadas pelo hash do token).

## Rotas

| Caminho | Arquivo | Acesso |
|---|---|---|
| `/` | `src/routes/index.tsx` | público |
| `/eventos/$slug` | `src/routes/eventos.$slug.index.tsx` | público |
| `/eventos/$slug/confirmacao/$codigo` | `src/routes/eventos.$slug.confirmacao.$codigo.tsx` | público (dados mínimos) |
| `/auth` | `src/routes/auth.tsx` | login e recuperação de senha |
| `/definir-senha` | `src/routes/definir-senha.tsx` | público (sessão vinda do link) |
| `/convite/$token` | `src/routes/convite.$token.tsx` | público (token válido) |
| `/admin` | `_authenticated/admin.tsx` + `admin.index.tsx` | equipe |
| `/admin/eventos`, `/admin/eventos/$id` | `_authenticated/admin.eventos.*.tsx` | equipe (escrita: admin/staff) |
| `/admin/participantes` | `_authenticated/admin.participantes.tsx` | equipe |
| `/admin/parceiros` | `_authenticated/admin.parceiros.tsx` | equipe |
| `/admin/usuarios` | `_authenticated/admin.usuarios.tsx` | admin |
| `/admin/historico` | `_authenticated/admin.historico.tsx` | admin |
| `/checkin` | `_authenticated/checkin.tsx` | equipe |

A visibilidade de menus por cargo é feita em `src/lib/use-roles.ts` e `src/components/admin/AdminShell.tsx`; isso é só interface — a proteção real está nas políticas RLS.

## Principais componentes

- `src/components/event/EventPage.tsx`, `EventHero.tsx`, `EventSections.tsx`: página pública; seções só aparecem quando há conteúdo.
- `src/components/event/RegistrationForm.tsx`: formulário e chamada da RPC.
- `src/components/event/RegistrationConfirmation.tsx`: código, QR Code e calendário.
- `src/components/admin/AdminShell.tsx`: layout da área da equipe.
- `src/components/admin/EventSelect.tsx`: seletor de evento compartilhado.
- `src/lib/format.ts`: validação de CPF/telefone, máscaras, `csvSafe`, `friendlyError`.
- `src/lib/events.ts`: tipos e utilidades de evento (`asList`, `calendarUrl`).
