# Auditoria de segurança — diagnóstico inicial e plano de correção

## 1. Arquitetura confirmada

- Site: TanStack Start (React 19), publicado no Lovable em ambiente edge (não Node).
- Backend: Lovable Cloud (PostgreSQL com RLS + autenticação por e-mail/senha). Sem armazenamento de arquivos, sem e-mail transacional próprio, sem funções de servidor próprias (nenhum `createServerFn` ou rota de API).
- Páginas públicas: `/`, `/eventos/$slug`, `/eventos/$slug/confirmacao/$codigo`, `/auth`.
- Páginas da equipe (exigem login): `/admin`, `/admin/participantes`, `/admin/eventos`, `/admin/parceiros`, `/admin/usuarios`, `/checkin`.
- Cargos: tabela separada `user_roles` (admin, staff, checkin), verificados no banco por `has_role`, `is_team`, `is_manager`.
- Escritas públicas só por funções do banco: `register_for_event`, `get_registration_confirmation`, `confirm_checkin`.
- Situação atual: 2 contas (1 admin ativo, 1 check-in ativo), ambas confirmadas; 2 inscrições.
- Não verificável por mim: backups/retenção do banco, configurações do workspace, histórico completo de login (só logs recentes).

## 2. Resultado dos scanners

- Security Scan: 1 aviso informativo (vínculo evento-parceiro público) — **falso positivo**, é conteúdo público da página do evento.
- Dependências: nenhuma vulnerabilidade conhecida.
- Linter do banco: funções internas executáveis por visitantes (detalhe abaixo).

## 3. Vulnerabilidades encontradas

**Alta**
1. **Admin desativado mantém poderes de admin.** `has_role` não verifica se a conta está ativa; uma conta "Ativo = desmarcado" continua podendo gerenciar cargos, apagar eventos e ler a equipe.
2. **Cadastro aberto + "primeira conta vira admin".** Qualquer pessoa cria conta em "Acesso da equipe". Hoje não ganha cargo (já existe admin), mas se o admin for removido, o próximo visitante a se cadastrar vira admin automaticamente.

**Média**
3. Funções internas (`has_role`, `is_team`, `is_manager`, `handle_new_user`) podem ser chamadas por visitantes — permitem sondar quem tem cargo a partir de um ID.
4. Consulta de confirmação por código (8 caracteres) sem limite de tentativas — permite adivinhar códigos e ver nome + alimento de participantes.
5. Sem limite de inscrições por tempo (abuso automatizado do formulário).
6. Sem histórico de ações administrativas (quem mudou cargo, desativou conta, exportou CSV, fez check-in manual).
7. Admin pode remover o próprio cargo de admin ou se desativar → risco de ficar sem administrador.

**Baixa / informativa**
8. Exportação CSV de participantes sem proteção contra "fórmulas" ao abrir no Excel.
9. Sem MFA para administradores.
10. Proteção contra senhas vazadas e regras de senha do login a confirmar/ativar.

Sem achados: segredos no código (só chave pública), SQL injection (tudo parametrizado), XSS (sem HTML bruto), CSRF (proteção ativa), RLS ligada em todas as tabelas, CPF/telefone nunca legíveis por visitantes.

## 4. Plano de correção (por prioridade)

### Etapa A — correções de banco (sem risco de perder dados)
- `has_role` passa a exigir conta ativa.
- Remover a regra "primeira conta vira admin" do cadastro automático.
- Revogar execução pública das funções internas; manter públicas só `register_for_event` e `get_registration_confirmation`.
- Impedir que um admin remova o último admin ativo ou desative a si mesmo (verificado no banco).
- Limite de tentativas no banco: consulta de confirmação e inscrição por janela de tempo.

### Etapa B — cadastro fechado com convites
- Desligar o cadastro público no login; "Acesso da equipe" vira só "Entrar" + "Esqueci minha senha" + página `/reset-password`.
- Nova tabela de convites: e-mail, nome, cargo, validade (24h), status (pendente, aceito, expirado, revogado), quem convidou. Só admin cria/revoga (validado no banco).
- Envio pelo convite oficial do sistema de login (e-mail com link de uso único), feito por função de servidor que confere se quem chama é admin ativo. Nenhuma chave privilegiada no navegador.
- Ao aceitar: a pessoa define a própria senha; o cargo é aplicado a partir do convite gravado no banco (nunca do formulário).
- Contas existentes preservadas.

### Etapa C — painel de equipe
- Em "Equipe": convidar, reenviar, cancelar convite; lista de pendentes/aceitos/expirados/revogados; busca e filtro; ativar/desativar; alterar cargo; encerrar sessões de um membro; "último acesso".
- Página "Histórico" (só admin) com o registro de auditoria.

### Etapa D — auditoria
- Tabela de histórico só de inserção (ninguém edita ou apaga): convites, cargos, ativação, check-in, exportações, alterações de evento. Grava data, autor, ação, alvo, sem senhas/tokens/CPF.

### Etapa E — reforços finais
- CSV com proteção contra fórmulas.
- Ativar proteção contra senhas vazadas.
- MFA (app autenticador) para admins — **opcional**, ver pergunta abaixo.
- Rodar novamente scanners e linter; testes automatizados dos cenários 1–18 aplicáveis; teste no navegador com conta real.

### Fora do escopo (não se aplica a este projeto)
- "Unidade/departamento" e importação CSV de colaboradores: a academia tem uma única equipe pequena; não vou criar campos fictícios. Posso adicionar se você quiser.
- Declaração de conformidade com a LGPD: faço só as correções técnicas; avaliação jurídica fica com você.

## 5. Riscos e reversão
- Etapa A e B mudam quem consegue entrar. Antes, confirmo que sua conta admin está ativa; tudo é aditivo (nenhuma conta, inscrição ou tabela apagada) e cada regra pode ser revertida por nova alteração.
- Nada será publicado automaticamente.

## Detalhes técnicos
- Migrações: `create or replace` de `has_role` (join profiles.active), `handle_new_user` sem bloco de admin; `revoke execute ... from anon, public` nas funções internas; trigger em `user_roles`/`profiles` contra remover último admin/autodesativação; tabela `rate_limits` (chave, janela, contador) usada dentro das RPCs públicas.
- Convites: tabela `staff_invites` + `audit_log` (insert via funções security-definer, select só admin, sem update/delete). Envio via `createServerFn` com `requireSupabaseAuth` → checa `has_role(admin)` com o cliente do usuário → `supabaseAdmin.auth.admin.inviteUserByEmail` carregado dentro do handler. Trigger no cadastro aplica cargo do convite pendente e válido para o e-mail.
- Desligar signup público via configuração de auth (convites continuam funcionando).
- Encerrar sessões: `auth.admin.signOut(userId)` via função de servidor admin.
