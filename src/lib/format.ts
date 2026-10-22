export const onlyDigits = (v: string) => (v || "").replace(/\D/g, "");

export function isValidCpf(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let s = 0;
    for (let i = 0; i < len; i++) s += Number(d[i]) * (len + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function formatCpf(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function formatPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const maskCpf = (cpf: string) => {
  const d = onlyDigits(cpf);
  return d.length === 11 ? `***.${d.slice(3, 6)}.***-${d.slice(9)}` : "—";
};

export const maskPhone = (p?: string | null) => {
  const d = onlyDigits(p || "");
  if (!d) return "—";
  return `(${d.slice(0, 2)}) *****-${d.slice(-4)}`;
};

export function formatDate(iso?: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateLong(iso?: string | null) {
  if (!iso) return null;
  const dt = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return dt.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export const formatTime = (t?: string | null) => (t ? t.slice(0, 5) : null);

export const TO_DEFINE = "Informação a definir";

export const STATUS_LABEL: Record<string, string> = {
  inscrito: "Inscrito",
  cancelado: "Cancelado",
  checkin: "Check-in realizado",
  ausente: "Ausente",
};

const ERRORS: Record<string, string> = {
  EVENT_NOT_FOUND: "Evento não encontrado.",
  EVENT_CLOSED: "Este evento já foi encerrado.",
  REGISTRATION_CLOSED: "As inscrições para este evento estão fechadas.",
  EVENT_FULL: "Evento lotado: todas as vagas foram preenchidas.",
  DUPLICATE: "Este CPF já está inscrito neste evento.",
  INVALID_CPF: "CPF inválido. Confira os números digitados.",
  INVALID_NAME: "Preencha nome e sobrenome.",
  INVALID_BIRTH_DATE: "Data de nascimento inválida.",
  INVALID_WHATSAPP: "WhatsApp inválido. Use DDD + número.",
  INVALID_FOOD: "Descrição do alimento muito longa.",
  CONSENT_REQUIRED: "É preciso aceitar o uso dos dados para se inscrever.",
  FORBIDDEN: "Você não tem permissão para esta ação.",
  NOT_FOUND: "Registro não encontrado.",
  CANCELLED: "Esta inscrição está cancelada.",
  RATE_LIMIT: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  LAST_ADMIN: "Não é possível: o sistema precisa de pelo menos um administrador ativo.",
  SELF_DEACTIVATE: "Você não pode desativar a sua própria conta.",
  SELF_DEMOTE: "Você não pode remover o seu próprio cargo de administrador.",
  ALREADY_PENDING: "Já existe um convite pendente para este e-mail.",
  USER_EXISTS: "Este e-mail já tem conta. Ajuste as permissões na lista da equipe.",
  INVALID_EMAIL: "E-mail inválido.",
  INVITE_CLOSED: "Este convite já foi aceito ou cancelado.",
  LINK_FAILED: "Não foi possível gerar o link. Se a pessoa já tem conta ativa, ajuste as permissões na lista de membros.",
  SEND_FAILED: "Não foi possível enviar o e-mail do convite. Tente novamente.",
};

/** Prevents spreadsheet formula injection when a CSV cell starts with =, +, -, @, tab or CR. */
export function csvSafe(v: string | undefined | null): string {
  const s = v ?? "";
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export function friendlyError(err: unknown): string {
  const msg = (err as { message?: string })?.message || "";
  for (const key of Object.keys(ERRORS)) if (msg.includes(key)) return ERRORS[key] ?? "";
  if (/fetch|network/i.test(msg)) return "Erro de conexão. Verifique sua internet e tente novamente.";
  if (/JWT|session/i.test(msg)) return "Sua sessão expirou. Entre novamente.";
  return "Não foi possível concluir agora. Tente novamente em instantes.";
}
