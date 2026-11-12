# Banco de dados

Fonte: `drizzle/migrations/0000_migration.sql` a `0004_invite_token_hash.sql`. Todas as tabelas estão no schema `public` com RLS ativado.

## Tipos

- `app_role`: `admin`, `staff`, `checkin`.
- `registration_status`: `inscrito`, `cancelado`, `checkin`, `ausente`.

## Tabelas

### profiles
`id` (uuid, PK, FK `auth.users` ON DELETE CASCADE), `name`, `email`, `active` (bool, padrão true), `created_at`. Criada pelo gatilho `handle_new_user` a cada novo usuário.

### user_roles
`id`, `user_id` (FK `auth.users` CASCADE), `role` (`app_role`). Único (`user_id`, `role`).

### events
`id`, `name`, `slug` (único), `slogan`, `description`, `date`, `start_time`, `end_time`, `location`, `status` (`draft`/`published`/`closed`), `registration_open`, `registration_limit`, `logo_url`, `cover_image_url`, `how_to_participate`, `food_rule_text`, `rules`/`activities`/`faq` (jsonb), `consent_text`, `consent_version`, `confirmation_message`, `created_at`, `updated_at` (gatilho `touch_updated_at`).

### partners / event_partners
`partners`: `id`, `name`, `logo_url`, `description`, `website`, `active`, `created_at`.
`event_partners`: PK (`event_id`, `partner_id`), ambos FK com CASCADE.

### participants
`id`, `first_name`, `last_name`, `cpf` (único, só dígitos), `birth_date`, `whatsapp`, `created_at`, `updated_at`.

### registrations
`id`, `event_id` (FK RESTRICT), `participant_id` (FK RESTRICT), `registration_code` (único), `food_item`, `registration_status`, `registered_at`, `checked_in_at`, `checked_in_by` (uuid, sem FK). Único (`event_id`, `participant_id`). Índice em `event_id`.

### consents
`id`, `participant_id` (FK CASCADE), `event_id` (FK CASCADE), `consent_type`, `consent_version`, `accepted_at`.

### audit_log
`id`, `created_at`, `actor_id`, `action`, `target`, `details` (jsonb). Só recebe linhas por funções/gatilhos internos.

### staff_invites
`id`, `email`, `name`, `role`, `status` (`pending`/`accepted`/`revoked`), `expires_at` (padrão +24h), `invited_by`, `send_count`, `created_at`, `accepted_at`, `revoked_at`, `token_hash` (0004). Índices únicos parciais: um convite pendente por e-mail (`staff_invites_one_pending`) e `token_hash` único quando preenchido.

### rate_limits
PK (`key`, `window_start`), `hits`. Sem políticas: só acessível por funções SECURITY DEFINER e service role.

## Relacionamentos

```text
auth.users 1-1 profiles ; auth.users 1-N user_roles
events 1-N registrations N-1 participants
events N-N partners (event_partners)
participants 1-N consents N-1 events
```

## Funções e RPCs

| Função | Quem pode executar | O que faz |
|---|---|---|
| `has_role(uid, role)`, `is_team(uid)`, `is_manager(uid)` | authenticated (`is_team` sem revogação explícita) | Desde 0002 só retornam true se `uid = auth.uid()` e o perfil está ativo. `is_manager` = admin ou staff. |
| `is_valid_cpf(text)` | padrão | Valida dígitos verificadores e rejeita sequências repetidas. |
| `register_for_event(...)` | anon, authenticated | Inscrição pública com todas as validações (ver CHECKIN.md). |
| `get_registration_confirmation(code)` | anon, authenticated | Retorna dados mínimos da inscrição; limite 30/10 min por IP. |
| `confirm_checkin(registration_id)` | authenticated | Exige `is_team`; marca check-in com data e operador. |
| `log_export(kind, rows)` | authenticated | Exige `is_manager`; grava auditoria de exportação. |
| `write_audit(...)` | ninguém externamente (revogado) | Insere no `audit_log` com `actor_id = auth.uid()`. |
| `hit_rate_limit(scope, max, seconds)` | ninguém externamente (revogado) | Contador por IP (`x-forwarded-for`) por janela. |
| Gatilhos: `handle_new_user`, `handle_user_confirmed`, `staff_invites_guard`, `user_roles_guard`, `profiles_guard`, `registrations_audit`, `touch_updated_at` | só como gatilho (execução revogada em 0002/0003) | Ver descrições abaixo. |

- `handle_new_user`: cria o perfil. Desde 0002 não concede admin automático.
- `handle_user_confirmed`: quando `email_confirmed_at` é preenchido, concede o cargo de um convite pendente válido e audita.
- `staff_invites_guard`: normaliza/valida e-mail, força status `pending`, limita 20 convites/hora por remetente, impede mudar e-mail/cargo/remetente, limita reenvios a 5 e audita criação/revogação/reenvio.
- `user_roles_guard`: bloqueia remover o último admin ativo (`LAST_ADMIN`) e autorremoção de admin (`SELF_DEMOTE`); audita.
- `profiles_guard`: impede alterar `id`/`email`/`created_at`, autodesativação e desativar o último admin; audita.
- `registrations_audit`: audita toda mudança de `registration_status`.

## Políticas de Row Level Security (todas)

| Tabela | Política | Operação / papel | Em linguagem simples |
|---|---|---|---|
| profiles | own profile or admin read | SELECT, authenticated | Cada pessoa vê o próprio perfil; admin vê todos. |
| profiles | admin update profiles | UPDATE, authenticated | Só admin altera perfis (gatilho ainda bloqueia autodesativação/último admin). |
| user_roles | own roles or admin read | SELECT | Cada um vê seus cargos; admin vê todos. |
| user_roles | admin insert roles | INSERT | Só admin concede cargos. |
| user_roles | admin delete roles | DELETE | Só admin remove cargos (com as travas do gatilho). |
| events | public reads published events | SELECT, anon+authenticated | Visitantes veem eventos publicados ou encerrados; rascunhos só a equipe. |
| events | managers insert events | INSERT | Admin e staff criam eventos. |
| events | managers update events | UPDATE | Admin e staff editam eventos. |
| events | admin delete events | DELETE | Só admin apaga eventos. |
| partners | read active partners | SELECT, anon+authenticated | Visitantes veem parceiros ativos; equipe vê todos. |
| partners | managers write partners | ALL | Admin e staff gerenciam parceiros. |
| event_partners | read event partners | SELECT, anon+authenticated | Vínculo evento-parceiro é público (`using (true)`). |
| event_partners | managers write event partners | ALL | Admin e staff alteram vínculos. |
| participants | team reads participants | SELECT | Só a equipe ativa (qualquer cargo) lê participantes. Ninguém insere/edita diretamente: só a RPC de inscrição. |
| registrations | team reads registrations | SELECT | Só a equipe lê inscrições. |
| registrations | managers update registrations | UPDATE | Admin e staff alteram inscrições (ex.: status). Cargo `checkin` só confirma via `confirm_checkin`. |
| consents | managers read consents | SELECT | Só admin e staff veem os registros de consentimento. |
| audit_log | admins read audit | SELECT | Só admin lê o histórico. Não há política de escrita: o cliente não grava. |
| staff_invites | admins read invites | SELECT | Só admin vê convites. |
| staff_invites | admins create invites | INSERT | Só admin cria convites. |
| staff_invites | admins update invites | UPDATE | Só admin revoga/reenvia (aceitar com sessão é bloqueado pelo gatilho). |
| rate_limits | (nenhuma) | — | Bloqueada para anon/authenticated. |

Observação: o anônimo tem `GRANT SELECT` apenas em `events`, `partners` e `event_partners`; tabelas com dados pessoais não têm grant para `anon`.
