# Segurança e LGPD

## Dados pessoais coletados

| Dado | Onde fica | Origem |
|---|---|---|
| Nome, sobrenome | `participants.first_name/last_name` | formulário público |
| CPF (só dígitos) | `participants.cpf` (único) | formulário público |
| Data de nascimento | `participants.birth_date` | formulário público |
| WhatsApp (opcional) | `participants.whatsapp` | formulário público |
| Alimento a doar | `registrations.food_item` | formulário público |
| Aceite e versão do termo | `consents` | formulário público |
| Nome e e-mail da equipe | `profiles`, `staff_invites`, autenticação | convites |
| IP do visitante | `rate_limits.key` (apagado após 1 dia por `hit_rate_limit`) | cabeçalho `x-forwarded-for` |
| Ações da equipe | `audit_log` | gatilhos |

## Como são protegidos

- **RLS:** anônimos não têm grant nem política em `participants`, `registrations`, `consents` (ver `docs/BANCO_DE_DADOS.md`). Inscrição e consulta pública passam por funções SECURITY DEFINER com `search_path` fixo.
- **Minimização:** `get_registration_confirmation` devolve só nome, alimento, código, status e slug — nunca CPF, nascimento ou telefone.
- **Mascaramento na interface:** `maskCpf` em `src/lib/format.ts`, usado em `checkin.tsx` e na lista de participantes. (É só visual; a equipe recebe o CPF completo da API.)
- **Papéis no servidor:** `has_role/is_team/is_manager` só respondem sobre `auth.uid()` e exigem perfil ativo (`0002`). Server functions de equipe usam `requireSupabaseAuth` + `assertAdmin` (`src/lib/team.functions.ts`).
- **Cadastro só por convite:** convites com expiração de 24h, token aleatório de 32 bytes guardado apenas como hash SHA-256 (`token_hash`), uso único.
- **Rate limit por IP:** 10 inscrições e 30 consultas de confirmação por 10 min (`hit_rate_limit`).
- **Exportação:** `csvSafe` neutraliza fórmulas (`= + - @ \t \r`) e `log_export` audita (`admin.participantes.tsx`).
- **Auditoria append-only:** `audit_log` sem escrita pelo cliente.
- **Chave de serviço:** usada apenas em código de servidor, carregada com `await import("@/integrations/supabase/client.server")` dentro dos handlers.

## Validações de entrada

| Campo | Navegador (`RegistrationForm.tsx`, zod) | Banco (`register_for_event`) |
|---|---|---|
| Nome/sobrenome | obrigatório, ≤80/≤120 | não vazio, ≤80/≤120 |
| CPF | `isValidCpf` | `is_valid_cpf` + normalização |
| Nascimento | formato, ≥1900, ≤ hoje | ≥1900-01-01, ≤ hoje |
| WhatsApp | 10 ou 11 dígitos se informado | idem |
| Alimento | ≤200 | ≤200 |
| Consentimento | obrigatório | `CONSENT_REQUIRED` |
| Evento | — | publicado, não encerrado, inscrições abertas, vagas |

Convites: e-mail validado na server function e no gatilho `staff_invites_guard`; senha 8–72 caracteres em `acceptInviteToken`.

## O que falta para adequação à LGPD

- Política de privacidade pública e identificação do controlador/encarregado (DPO): não encontrado no código.
- Fluxo para o titular acessar, corrigir, exportar ou excluir seus dados (art. 18): não encontrado no código.
- Prazo de retenção e anonimização automática após o evento: não encontrado no código.
- Base legal para coleta de data de nascimento e tratamento de menores (consentimento dos responsáveis): não encontrado no código.
- O texto de consentimento inicial é genérico (migração 0000) e precisa de revisão jurídica.
- Registro de consentimento não guarda o texto aceito, apenas `consent_version`.
- MFA para administradores: não encontrado no código.
- Criptografia em nível de coluna para CPF: não encontrado no código (depende da criptografia do provedor em disco).
