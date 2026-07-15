export const TICKET_CATEGORIES = [
  { value: "analisis",   label: "Análisis",   icon: "📊", color: "#3b82f6" },
  { value: "insights",   label: "Insights",   icon: "💡", color: "#8b5cf6" },
  { value: "estrategia", label: "Estrategia", icon: "🎯", color: "#f59e0b" },
  { value: "datos",      label: "Datos",      icon: "📈", color: "#10b981" },
  { value: "reporte",    label: "Reporte",    icon: "📄", color: "#06b6d4" },
  { value: "soporte",    label: "Soporte",    icon: "🛠️", color: "#f97316" },
  { value: "otro",       label: "Otro",       icon: "📋", color: "#6b7280" },
] as const;

export const TICKET_STATUSES = [
  { value: "abierto",      label: "Abierto",      color: "#3b82f6" },
  { value: "en_progreso",  label: "En Progreso",  color: "#f59e0b" },
  { value: "en_revision",  label: "En Revisión",  color: "#8b5cf6" },
  { value: "resuelto",     label: "Resuelto",     color: "#10b981" },
  { value: "cerrado",      label: "Cerrado",      color: "#6b7280" },
] as const;

export const TICKET_PRIORITIES = [
  { value: "baja",    label: "Baja",    color: "#6b7280" },
  { value: "media",   label: "Media",   color: "#f59e0b" },
  { value: "alta",    label: "Alta",    color: "#f97316" },
  { value: "critica", label: "Crítica", color: "#ef4444" },
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number]["value"];
export type TicketStatus   = (typeof TICKET_STATUSES)[number]["value"];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]["value"];

export function getCategoryInfo(value: string) {
  return TICKET_CATEGORIES.find((c) => c.value === value) ?? TICKET_CATEGORIES[6];
}

export function getStatusInfo(value: string) {
  return TICKET_STATUSES.find((s) => s.value === value) ?? TICKET_STATUSES[0];
}

export function getPriorityInfo(value: string) {
  return TICKET_PRIORITIES.find((p) => p.value === value) ?? TICKET_PRIORITIES[1];
}
