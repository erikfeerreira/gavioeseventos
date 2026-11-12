# Check-in

## QR Code

- Gerado **no navegador** em `src/components/event/RegistrationConfirmation.tsx`, dentro de um `useEffect` que sai imediatamente no servidor (`if (import.meta.env.SSR) return;`) e importa dinamicamente `qrcode/lib/browser` (versão sem APIs do Node, para não quebrar o servidor Edge).
- Conteúdo: a URL `${window.location.origin}/checkin?codigo=<registration_code>`, renderizada como imagem data URI (`QRCode.toDataURL`, largura 360).
- **Não é dinâmico/rotativo:** o QR é derivado de um código fixo por inscrição; não há expiração nem assinatura. Não há leitor de câmera no código: o QR abre a URL e a página `src/routes/_authenticated/checkin.tsx` lê `?codigo=` (via `validateSearch` com zod) e já executa a busca. Quem abre precisa estar logado como equipe.
- O código de inscrição é gerado em `register_for_event` (versão atual em `0002_security_hardening_invites_audit.sql`): 8 caracteres hexadecimais maiúsculos de `md5(gen_random_uuid() || clock_timestamp())`, repetindo até não colidir, com `UNIQUE` em `registrations.registration_code`.

## Busca na portaria

`checkin.tsx` consulta `registrations` com join em `participants` filtrando por evento: código (8 hex), dígitos de CPF/WhatsApp (`like`) ou nome (`ilike`), limite de 20 resultados. Só retorna linhas porque a política RLS "team reads registrations" permite à equipe.

## Confirmação e concorrência

`confirm_checkin(_registration_id)` (`0000_migration.sql`):

1. `if not is_team(auth.uid()) then raise 'FORBIDDEN'`.
2. `select ... from registrations where id = ... for update` — **trava a linha** até o fim da transação.
3. Se já está `checkin` → retorna `ALREADY` (idempotente). Se `cancelado` → `CANCELLED`.
4. Senão: `registration_status = 'checkin'`, `checked_in_at = now()`, `checked_in_by = auth.uid()` → retorna `OK`.

Dois operadores confirmando a mesma pessoa ao mesmo tempo: o segundo espera o lock, relê o status e recebe `ALREADY`. A interface mostra "Participante já registrado."

## Controle atômico de capacidade

A capacidade é controlada **na inscrição, não no check-in** (o check-in não verifica limite — não encontrado no código). Em `register_for_event`:

```sql
perform pg_advisory_xact_lock(hashtext(_event_id::text));
if ev.registration_limit is not null then
  select count(*) into cnt from registrations
   where event_id = _event_id and registration_status <> 'cancelado';
  if cnt >= ev.registration_limit then raise exception 'EVENT_FULL'; end if;
end if;
```

O advisory lock por evento serializa inscrições simultâneas do mesmo evento durante a transação, então a contagem e o insert não podem intercalar. Duplicidade da mesma pessoa no evento é barrada por `UNIQUE (event_id, participant_id)` e pela checagem `DUPLICATE`. Observação: `hashtext` pode colidir entre eventos diferentes; isso só causa espera extra, não erro.

## Log de auditoria por operador

- `registrations.checked_in_by` guarda o `auth.uid()` de quem confirmou e `checked_in_at` a hora.
- O gatilho `registrations_audit` (AFTER UPDATE, `0002`) chama `write_audit('registration_status', registration_code, {from, to})`, que insere em `audit_log` com `actor_id = auth.uid()`.
- `audit_log` não tem política de INSERT/UPDATE/DELETE para clientes e `write_audit` tem execução revogada; só admin lê (política "admins read audit"), exibido em `src/routes/_authenticated/admin.historico.tsx`.
