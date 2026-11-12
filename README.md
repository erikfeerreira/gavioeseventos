# Gaviões Eventos — Plataforma de inscrições e check-in

Plataforma web para a Academia Gaviões Poá divulgar eventos, receber inscrições públicas e controlar a presença no dia do evento. O primeiro evento cadastrado na migração inicial é "GAVIÕES NA AREIA" (`drizzle/migrations/0000_migration.sql`).

## Funcionalidades

**Público (sem login)**
- Página inicial e página do evento com textos, regras, atividades, FAQ e parceiros lidos da tabela `events` (`src/routes/index.tsx`, `src/routes/eventos.$slug.index.tsx`, `src/components/event/*`).
- Formulário de inscrição com validação de CPF, data de nascimento, WhatsApp e consentimento (`src/components/event/RegistrationForm.tsx`), gravado pela função do banco `register_for_event`.
- Página de confirmação com código de inscrição, QR Code, link para calendário e impressão (`src/routes/eventos.$slug.confirmacao.$codigo.tsx`, `src/components/event/RegistrationConfirmation.tsx`).
- Ativação de conta de colaborador por link de convite (`src/routes/convite.$token.tsx`) e definição de senha (`src/routes/definir-senha.tsx`).

**Equipe (com login, `src/routes/_authenticated/`)**
- Painel com indicadores (`admin.index.tsx`), cadastro/edição de eventos (`admin.eventos.index.tsx`, `admin.eventos.$id.tsx`), parceiros (`admin.parceiros.tsx`).
- Lista de participantes com dados mascarados, filtros e exportação CSV (`admin.participantes.tsx`).
- Check-in por código, CPF, nome, WhatsApp ou leitura do QR (`checkin.tsx`).
- Gestão de equipe: convites por e-mail ou link, cargos, bloqueio de acesso (`admin.usuarios.tsx`, `src/lib/team.functions.ts`).
- Histórico de auditoria, somente admin (`admin.historico.tsx`).

## Stack (versões do `package.json`)

| Área | Tecnologia |
|---|---|
| Framework | TanStack Start 1.168.60, TanStack Router 1.170.41, React ^19.2.0 |
| Dados no cliente | @tanstack/react-query ^5.101.1, @supabase/supabase-js ^2.117.2 |
| Estilo/UI | Tailwind CSS ^4.2.1, Radix UI, lucide-react ^0.575.0, sonner ^2.0.7 |
| Validação | zod ^3.25.76, react-hook-form ^7.71.2 |
| Gráficos / QR | recharts ^3.10.1, qrcode ^1.5.4 |
| Build | Vite 8.1.5, nitro 3.0.260603-beta, TypeScript ^5.8.3 |
| Testes | Vitest ^4.1.10, Testing Library, jsdom |
| Banco | PostgreSQL gerenciado (Lovable Cloud), migrações SQL em `drizzle/migrations/` |

## Estrutura de pastas

```text
src/
  routes/            páginas (roteamento por arquivo do TanStack Router)
    _authenticated/  área da equipe (exige login)
  components/
    event/           página pública do evento, formulário, confirmação
    admin/           AdminShell (layout/menu) e EventSelect
    brand/           Logo
    ui/              componentes base (shadcn/Radix)
  lib/               formatação/validação, eventos, papéis, server functions de equipe
  integrations/      cliente do banco/autenticação (gerado automaticamente)
  test/              testes Vitest
drizzle/migrations/  esquema, funções, gatilhos e políticas RLS
docs/                documentação técnica
```

## Como rodar localmente

```sh
bun install        # ou npm install
bun run dev        # servidor de desenvolvimento (Vite)
bun run test       # testes (Vitest)
bun run build      # build de produção
```

É necessário um projeto de banco com as migrações de `drizzle/migrations/` aplicadas em ordem.

## Variáveis de ambiente (somente nomes)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_SERVICE_ROLE_KEY` (apenas servidor, usada por `src/integrations/supabase/client.server.ts`)
- `PUBLIC_SITE_URL` (opcional, usada em `src/lib/team.functions.ts` para o link de redefinição de senha)

## Documentação

- [Arquitetura](docs/ARQUITETURA.md)
- [Banco de dados](docs/BANCO_DE_DADOS.md)
- [Check-in](docs/CHECKIN.md)
- [Segurança e LGPD](docs/SEGURANCA_LGPD.md)

## Como usei IA neste projeto

<!-- Preencher -->

