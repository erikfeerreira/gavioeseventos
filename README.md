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

Neste projeto, utilizei inteligência artificial generativa (Lovable) como acelerador de engenharia e copiloto técnico, mantendo total controle e responsabilidade sobre os requisitos de produto, arquitetura de software, segurança e validação das entregas.

### 1. Papel como condutor técnico e de produto
* **Regras de negócio e arquitetura:** Defini os modelos de dados, os fluxos do participante e da equipe de recepção, a política de não exclusão de registros (soft states) e a exigência de que dados sensíveis (PII) nunca fiquem expostos a acessos anônimos.
* **Critérios de segurança e LGPD:** Estabeleci que todas as operações públicas (inscrição, consulta de confirmação e check-in) operassem exclusivamente por stored procedures `SECURITY DEFINER` com `Row Level Security (RLS)` restrito e `rate limiting` por IP.

### 2. Depuração e resolução de problemas de produção
* **Isolamento de runtime Node vs. Edge:** Durante a publicação para Edge (Cloudflare Workers), conduzi a investigação de um erro HTTP 500 provocado pelo empacotamento de dependências com chamadas `createRequire` do Node (`qrcode`/`pngjs`). A solução adotada foi isolar o import para o entry point de navegador (`qrcode/lib/browser`) sob lazy loading estrito ao cliente, preservando a performance do SSR.

### 3. Hardening de cibersegurança a partir de auditoria real
* A partir de um relatório de auditoria de cibersegurança, orientei o refatoramento da camada de autenticação:
  * Desativação de cadastros públicos (`public signup`);
  * Criação de tabela de auditoria append-only (`audit_log`);
  * Implementação de gatilhos de integridade no banco contra remoção acidental do último administrador;
  * Criação de fluxo alternativo e seguro de convite de equipe via link criptográfico único (SHA-256) com expiração em 24h, sem expor senhas e sem dependência de entregabilidade de e-mail.

### 4. Validação e Qualidade
* Nenhum código foi aceito sem validação prévia. Toda funcionalidade crítica foi testada ponta a ponta (E2E com Playwright e testes automatizados com Vitest), garantindo sanitização de inputs (prevenção de CSV Injection, validação algorítmica de CPF) e integridade referencial.
