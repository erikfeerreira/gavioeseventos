# Sistema de Eventos — Academia Gaviões Poá

Plataforma reutilizável de eventos (primeiro evento: **Gaviões na Areia**, 24/10/2026), construída nas 10 fases do briefing. Nenhuma informação comercial será inventada — campos vazios aparecem como "Informação a definir" ou ficam ocultos.

## Visual
- Preto, vermelho, vermelho escuro, grafite e branco. Tipografia esportiva condensada (Barlow Condensed nos títulos, Barlow no texto).
- Logo oficial usado exatamente como enviado (versão colorida em fundos claros, negativa em fundos escuros). Favicon a partir do logo.
- Toque de areia no evento (textura/tom areia discreto), sem estética tropical.
- Mobile first, botões grandes, poucas animações.

## Páginas
- `/` — redireciona/mostra o evento ativo principal.
- `/eventos/$slug` — página pública: Hero (nome, slogan, data, "QUERO ME INSCREVER"), Sobre, Como participar, Regra do alimento, Atividades*, Parceiros*, FAQ*, Inscrição, Rodapé. (*só aparece se houver itens cadastrados)
- `/eventos/$slug/confirmacao/$codigo` — confirmação com nome, evento, data, local, código, QR Code, alimento, regras; "Adicionar ao calendário" só com data+horário.
- `/login` — acesso da equipe.
- `/admin` — dashboard (cards + gráficos de inscrições no tempo e presença x ausência).
- `/admin/eventos` e `/admin/eventos/$id` — criar/editar evento: textos, data, horário, local, vagas, capa, regras, atividades, FAQ, parceiros, consentimento LGPD, mensagem de confirmação, abrir/fechar inscrições.
- `/admin/participantes` — tabela com CPF/WhatsApp mascarados, busca, filtros (evento, status, presença), ordenação, paginação, exportar CSV.
- `/admin/parceiros` — cadastro de parceiros.
- `/admin/usuarios` — atribuir papéis (ADMIN/STAFF/CHECKIN).
- `/checkin` — busca por CPF, nome, WhatsApp ou código; "CONFIRMAR PRESENÇA" → "PRESENÇA CONFIRMADA"; bloqueia duplicado ("Participante já registrado.").

## Regras de negócio
- Campos: nome, sobrenome, CPF, nascimento (obrigatórios), WhatsApp, alimento ("Ex.: arroz, feijão, macarrão...") e aceite de consentimento.
- CPF validado (dígitos), normalizado e único por evento; nascimento não pode ser futuro; validação no navegador e no servidor.
- Bloqueio quando inscrições fechadas, evento encerrado ou lotado.
- Status: INSCRITO, CANCELADO, CHECK-IN REALIZADO, AUSENTE — nada é apagado.
- Check-in registra data/hora e quem confirmou.
- Mensagens de erro amigáveis, nunca técnicas.

## Segurança
- Lovable Cloud (banco, login, regras de acesso). Login por e-mail/senha para a equipe; sem cadastro público — o primeiro usuário que se cadastrar vira ADMIN, os demais precisam receber papel de um ADMIN.
- Público nunca lê inscritos: inscrição feita por função de servidor que valida tudo; confirmação lida só pelo código único (dados mínimos).
- Papéis em tabela separada, verificados no banco (RLS + função `has_role`). CHECKIN só busca e confirma; STAFF gerencia eventos/participantes; ADMIN tudo, incluindo usuários.
- Exportação CSV só para ADMIN/STAFF.

## Detalhes técnicos
- Tabelas: events (com campos JSON configuráveis: rules, activities, faq, texts, consent_text/version, confirmation_message), participants, registrations (code único, status enum, checked_in_at/by), partners, event_partners, consents, profiles, user_roles (enum app_role admin/staff/checkin). GRANTs + RLS em todas.
- Migração cria o evento Gaviões na Areia (data 2026-10-24, nome, slogan, descrição do briefing; horário, local e vagas vazios).
- Server functions: `registerForEvent` (pública, validação zod + CPF, usa cliente admin após validar), `getConfirmation` (por código), `searchCheckin`/`confirmCheckin`, `listParticipants`, `exportCsv`, `dashboardMetrics` — todas protegidas exceto as públicas.
- QR Code gerado na confirmação (lib `qrcode`); scanner fica para depois, mas `/checkin?codigo=` já abre o registro.
- Gráficos com Recharts. Componentes: EventHero, EventInfo, RegistrationForm, EventRules, PartnerSection, CheckIn, ParticipantTable, DashboardCards, EventSettings, RegistrationConfirmation.

## Informações que vou precisar de vocês depois
Horário, local/endereço, limite de vagas, parceiros, atividades, FAQ, contatos da academia e texto de consentimento LGPD revisado (deixo um texto simples e editável).
