"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Ticket, AlertCircle, Clock, CheckCircle2, Plus, Search,
  ChevronRight, Loader2, UserCheck, MessageSquare, FileText, PenLine,
} from "lucide-react";
import { TICKET_CATEGORIES, TICKET_STATUSES, TICKET_PRIORITIES } from "@/lib/constants";

// ── Types ───────────────────────────────────────────

interface UserRef {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive?: boolean;
}

interface TicketRow {
  _id: string;
  ticketNumber: number;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  source: string;
  createdBy: UserRef;
  assignedTo: UserRef | null;
  tags: string[];
  dueDate: string | null;
  createdAt: string;
  aiSuggestion: string | null;
  journalistName?: string | null;
  objective?: string | null;
}

interface Stats {
  total: number;
  open: number;
  closed: number;
  resolved: number;
  unassigned: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
}

// ── API helper ──────────────────────────────────────

async function apiFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Source badge ────────────────────────────────────

function SourceBadge({ source }: { source: string }) {
  if (source === "solicitud_publicacion") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <PenLine size={11} />
        Solicitud
      </span>
    );
  }
  return null;
}

// ── Create Ticket Modal ─────────────────────────────

function CreateTicketModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"interno" | "solicitud">("interno");
  const [error, setError] = useState("");

  // Form state - common
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("analisis");
  const [assignedTo, setAssignedTo] = useState("");

  // Form state - solicitud de publicación
  const [journalistName, setJournalistName] = useState("");
  const [strategicTiming, setStrategicTiming] = useState("");
  const [baseText, setBaseText] = useState("");
  const [mustInclude, setMustInclude] = useState("");
  const [supportingMaterials, setSupportingMaterials] = useState("");

  const { data: users } = useQuery<{ users: UserRef[] }>({
    queryKey: ["assignable-users"],
    queryFn: () => apiFetch("/api/tickets/assignable-users"),
  });

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch("/api/tickets", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["ticket-stats"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const titleVal = tab === "solicitud" ? (journalistName ? `${title} — ${journalistName}` : title) : title;
    if (!titleVal.trim() || !description.trim()) {
      setError("Título y descripción son obligatorios");
      return;
    }
    createMut.mutate({
      title: titleVal.trim(),
      description: description.trim(),
      category,
      source: tab === "solicitud" ? "solicitud_publicacion" : "interna",
      assignedTo: assignedTo || null,
      ...(tab === "solicitud" && {
        journalistName: journalistName.trim() || null,
        strategicTiming: strategicTiming.trim() || null,
        baseText: baseText.trim() || null,
        mustInclude: mustInclude.trim() || null,
        supportingMaterials: supportingMaterials.trim() || null,
      }),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto fade-in">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Nuevo ticket</h2>
          <p className="text-sm text-gray-400 mt-0.5">Crea una solicitud interna o de publicación</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          <button
            type="button"
            onClick={() => { setTab("interno"); setError(""); }}
            className={`pb-3 pt-4 px-4 text-sm font-medium border-b-2 transition ${
              tab === "interno"
                ? "border-red-600 text-red-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            📋 Ticket Interno
          </button>
          <button
            type="button"
            onClick={() => { setTab("solicitud"); setError(""); }}
            className={`pb-3 pt-4 px-4 text-sm font-medium border-b-2 transition ${
              tab === "solicitud"
                ? "border-red-600 text-red-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            ✍️ Solicitud de Publicación
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* ── COMMON FIELDS ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tab === "solicitud" ? "Nombre del requerimiento *" : "Título *"}
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                tab === "solicitud"
                  ? "Ej: Reforma laboral, Especial Colombia +20 | Economía circular"
                  : "Ej: Analizar tendencia de suscripciones Q3"
              }
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              required
            />
            {tab === "solicitud" && (
              <p className="text-xs text-gray-400 mt-1">
                Asigna un nombre claro que nos permita identificar la solicitud durante todo el proceso.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tab === "solicitud" ? "¿Qué queremos comunicar? *" : "Descripción *"}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                tab === "solicitud"
                  ? "Describe brevemente el objetivo de la publicación y/o el mensaje principal que quieres transmitir.\nEj: Que la reforma laboral cambia la jornada nocturna, los recargos dominicales y el contrato de aprendizaje."
                  : "Describe la solicitud en detalle. Incluye contexto, datos relevantes y expectativas."
              }
              rows={4}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
              required
            />
          </div>

          {/* ── SOLICITUD-SPECIFIC FIELDS ── */}
          {tab === "solicitud" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del periodista solicitante</label>
                <input
                  value={journalistName}
                  onChange={(e) => setJournalistName(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ¿Cuándo consideras estratégico publicar este contenido?
                </label>
                <input
                  value={strategicTiming}
                  onChange={(e) => setStrategicTiming(e.target.value)}
                  placeholder="Ej: Esta semana, antes del viernes. Urgente — está ligado a la coyuntura."
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Indica la fecha, hora o nivel de urgencia.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Texto base para la publicación</label>
                <textarea
                  value={baseText}
                  onChange={(e) => setBaseText(e.target.value)}
                  placeholder="Comparte el texto inicial o borrador que servirá como base para construir el contenido. No es necesario que sea la versión final."
                  rows={5}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">¿Hay algo que no podamos dejar por fuera?</label>
                <textarea
                  value={mustInclude}
                  onChange={(e) => setMustInclude(e.target.value)}
                  placeholder="Ej: Mostrar la cronología de los hechos, incluir a los cinco candidatos, no usar la foto de archivo, destacar la cifra principal, etc."
                  rows={3}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Información de apoyo</label>
                <textarea
                  value={supportingMaterials}
                  onChange={(e) => setSupportingMaterials(e.target.value)}
                  placeholder="Adjunta o comparte el artículo, enlaces, documentos, imágenes o cualquier otro material de referencia que pueda servir para desarrollar la publicación."
                  rows={3}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                />
              </div>
            </>
          )}

          {/* ── COMMON META FIELDS ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asignar a (opcional)</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">Sin asignar</option>
                {users?.users?.filter((u) => u.isActive !== false).map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMut.isPending}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-2"
            >
              {createMut.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
              {createMut.isPending
                ? "Creando…"
                : tab === "solicitud"
                  ? "Enviar Solicitud"
                  : "Crear Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Status Badge ────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const info = TICKET_STATUSES.find((s) => s.value === status);
  if (!info) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: `${info.color}12`, color: info.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: info.color }} />
      {info.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const info = TICKET_PRIORITIES.find((p) => p.value === priority);
  if (!info) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: `${info.color}15`, color: info.color }}
    >
      {info.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const info = TICKET_CATEGORIES.find((c) => c.value === category);
  return (
    <span className="text-xs text-gray-500">
      {info?.icon ?? "📋"} {info?.label ?? category}
    </span>
  );
}

// ── Stats Card ──────────────────────────────────────

function StatCard({
  label, value, icon, color, sub,
}: {
  label: string; value: string | number; icon: React.ReactNode; color: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}12`, color }}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────

export default function DashboardPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("abierto,en_progreso,en_revision");

  const { data: stats } = useQuery<Stats>({
    queryKey: ["ticket-stats"],
    queryFn: () => apiFetch("/api/tickets/stats"),
    refetchInterval: 30_000,
  });

  const { data: ticketsData, isLoading } = useQuery<{ tickets: TicketRow[] }>({
    queryKey: ["tickets", search, filterStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (filterStatus) params.set("status", filterStatus);
      return apiFetch(`/api/tickets?${params.toString()}`);
    },
  });

  const tickets = ticketsData?.tickets ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Resumen de tickets y solicitudes</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
        >
          <Plus size={16} />
          Nuevo
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Totales"       value={stats.total}       icon={<Ticket size={18} />} color="#6b7280" />
          <StatCard label="Abiertos"      value={stats.open}        icon={<AlertCircle size={18} />} color="#3b82f6" sub={stats.byStatus.abierto > 0 ? `${stats.byStatus.abierto} nuevos` : undefined} />
          <StatCard label="En Progreso"   value={stats.byStatus.en_progreso} icon={<Clock size={18} />} color="#f59e0b" />
          <StatCard label="Resueltos"     value={stats.resolved}    icon={<CheckCircle2 size={18} />} color="#10b981" />
          <StatCard label="Sin asignar"   value={stats.unassigned}  icon={<UserCheck size={18} />} color="#8b5cf6" />
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tickets..."
            className="w-full pl-9 pr-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
        </div>
        <div className="flex gap-2">
          {[
            { value: "abierto,en_progreso,en_revision", label: "Activos" },
            { value: "resuelto", label: "Resueltos" },
            { value: "cerrado", label: "Cerrados" },
            { value: "", label: "Todos" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition border ${
                filterStatus === opt.value
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">
            Tickets ({tickets.length})
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-gray-400" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12">
            <Ticket size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">No hay tickets que mostrar</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Crear el primer ticket
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {tickets.map((ticket) => (
              <Link
                key={ticket._id}
                href={`/tickets/${ticket._id}`}
                className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                    <span className="text-xs font-mono text-gray-400">#{ticket.ticketNumber}</span>
                    <CategoryBadge category={ticket.category} />
                    <PriorityBadge priority={ticket.priority} />
                    <SourceBadge source={ticket.source} />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 group-hover:text-red-700 transition truncate">
                    {ticket.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                    {ticket.source === "solicitud_publicacion" && ticket.objective
                      ? ticket.objective
                      : ticket.description}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-400">
                      {new Date(ticket.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                    </span>
                    {ticket.journalistName && (
                      <span className="text-xs text-emerald-600 flex items-center gap-1">
                        <PenLine size={11} />
                        {ticket.journalistName}
                      </span>
                    )}
                    {ticket.assignedTo && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <UserCheck size={11} />
                        {ticket.assignedTo.name}
                      </span>
                    )}
                    {ticket.aiSuggestion && (
                      <span className="text-xs text-violet-500 flex items-center gap-1">
                        <MessageSquare size={11} />
                        IA analizado
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusBadge status={ticket.status} />
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && <CreateTicketModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
