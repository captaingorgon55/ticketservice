"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Ticket, AlertCircle, Clock, CheckCircle2, Plus, Search,
  ChevronRight, Loader2, UserCheck, MessageSquare, PenLine,
  BarChart3, Users, TrendingUp, InboxIcon,
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

interface WorkloadEntry {
  _id: string | null;
  name: string;
  email: string;
  area: string;
  total: number;
  abierto: number;
  en_progreso: number;
  en_revision: number;
  resuelto: number;
  cerrado: number;
  active: number;
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

// ── Shared badge components ──────────────────────────

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

// ── Mini bar chart ───────────────────────────────────

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs text-gray-500 w-6 text-right">{value}</span>
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────

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

// ── Create Ticket Modal ──────────────────────────────

async function uploadToCloudinary(file: File): Promise<{ name: string; url: string; type: string }> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset    = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !preset) throw new Error("Cloudinary no configurado");
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", preset);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Error al subir archivo");
  const data = await res.json() as { secure_url: string };
  return { name: file.name, url: data.secure_url, type: file.type };
}

function CreateTicketModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"im" | "redes">("im");
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("analisis");
  const [assignedTo, setAssignedTo] = useState("");
  const [journalistName, setJournalistName] = useState("");
  const [strategicTiming, setStrategicTiming] = useState("");
  const [baseText, setBaseText] = useState("");
  const [mustInclude, setMustInclude] = useState("");
  const [supportingMaterials, setSupportingMaterials] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role;

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
      qc.invalidateQueries({ queryKey: ["ticket-workload"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const titleVal = tab === "redes" ? (journalistName ? `${title} — ${journalistName}` : title) : title;
    if (!titleVal.trim() || !description.trim()) {
      setError("Título y descripción son obligatorios");
      return;
    }
    let attachments: { name: string; url: string; type: string }[] = [];
    if (files.length > 0) {
      setUploading(true);
      try {
        attachments = await Promise.all(files.map(uploadToCloudinary));
      } catch {
        setError("Error al subir archivos. Verifica la configuración de Cloudinary.");
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    createMut.mutate({
      title: titleVal.trim(),
      description: description.trim(),
      category,
      source: tab === "redes" ? "solicitud_publicacion" : "interna",
      assignedTo: assignedTo || null,
      attachments,
      ...(tab === "redes" && {
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Nuevo ticket</h2>
          <p className="text-sm text-gray-400 mt-0.5">Crea una solicitud interna o de publicación</p>
        </div>
        <div className="flex border-b border-gray-100 px-6">
          {(["im", "redes"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setError(""); }}
              className={`pb-3 pt-4 px-4 text-sm font-medium border-b-2 transition ${
                tab === t ? "border-red-600 text-red-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "im" ? "📊 Solicitud IM" : "📱 Solicitud Redes"}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tab === "redes" ? "Nombre del requerimiento *" : "Título *"}
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tab === "redes" ? "Ej: Despliegue Política, Carrusel Fin de semana" : "Ej: Despliegue Política, Carrusel Fin de semana"}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tab === "redes" ? "¿Qué queremos comunicar? *" : "Descripción *"}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tab === "redes" ? "Describe el objetivo de la publicación y el mensaje principal." : "Describe la solicitud en detalle."}
              rows={4}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              required
            />
          </div>
          {tab === "redes" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del periodista solicitante</label>
                <input value={journalistName} onChange={(e) => setJournalistName(e.target.value)} placeholder="Tu nombre" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">¿Cuándo publicar?</label>
                <input value={strategicTiming} onChange={(e) => setStrategicTiming(e.target.value)} placeholder="Ej: Esta semana, antes del viernes." className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Texto base</label>
                <textarea value={baseText} onChange={(e) => setBaseText(e.target.value)} placeholder="Borrador inicial de la publicación." rows={4} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">¿Hay algo que no podamos dejar por fuera?</label>
                <textarea value={mustInclude} onChange={(e) => setMustInclude(e.target.value)} placeholder="Ej: Mostrar la cronología, incluir a los candidatos…" rows={3} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Información de apoyo</label>
                <textarea value={supportingMaterials} onChange={(e) => setSupportingMaterials(e.target.value)} placeholder="Adjunta o comparte enlaces, documentos, imágenes…" rows={3} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>
            {role === "admin" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asignar a (opcional)</label>
                <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                  <option value="">Sin asignar</option>
                  {users?.users?.filter((u) => u.isActive !== false).map((u) => (
                    <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {/* Adjuntos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Archivos adjuntos</label>
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
            />
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                    <span className="truncate">{f.name}</span>
                    <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 ml-2">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
              Cancelar
            </button>
            <button type="submit" disabled={createMut.isPending || uploading} className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-2">
              {(createMut.isPending || uploading) && <Loader2 size={14} className="animate-spin" />}
              {uploading ? "Subiendo archivos…" : createMut.isPending ? "Creando…" : tab === "redes" ? "Enviar Solicitud" : "Crear Solicitud"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Ticket list (shared) ─────────────────────────────

function TicketList({
  tickets,
  isLoading,
  onCreateClick,
}: {
  tickets: TicketRow[];
  isLoading: boolean;
  onCreateClick: () => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }
  if (tickets.length === 0) {
    return (
      <div className="text-center py-12">
        <InboxIcon size={40} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-400">No hay tickets que mostrar</p>
        <button onClick={onCreateClick} className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium">
          Crear el primer ticket
        </button>
      </div>
    );
  }
  return (
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
              {ticket.source === "solicitud_publicacion" && ticket.objective ? ticket.objective : ticket.description}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-gray-400">
                {new Date(ticket.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
              </span>
              {ticket.journalistName && (
                <span className="text-xs text-emerald-600 flex items-center gap-1">
                  <PenLine size={11} /> {ticket.journalistName}
                </span>
              )}
              {ticket.assignedTo && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <UserCheck size={11} /> {ticket.assignedTo.name}
                </span>
              )}
              {ticket.aiSuggestion && (
                <span className="text-xs text-violet-500 flex items-center gap-1">
                  <MessageSquare size={11} /> IA analizado
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
  );
}

// ── Admin Dashboard ──────────────────────────────────

function AdminDashboard({ onCreateClick }: { onCreateClick: () => void }) {
  const [search, setSearch]           = useState("");
  const [filterStatus, setFilterStatus] = useState("abierto,en_progreso,en_revision");
  const [filterPriority, setFilterPriority] = useState("");

  const { data: stats } = useQuery<Stats>({
    queryKey: ["ticket-stats"],
    queryFn: () => apiFetch("/api/tickets/stats"),
    refetchInterval: 30_000,
  });

  const { data: workloadData } = useQuery<{ workload: WorkloadEntry[] }>({
    queryKey: ["ticket-workload"],
    queryFn: () => apiFetch("/api/tickets/workload"),
    refetchInterval: 60_000,
  });

  const { data: ticketsData, isLoading } = useQuery<{ tickets: TicketRow[] }>({
    queryKey: ["tickets", search, filterStatus, filterPriority],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set("q", search);
      if (filterStatus) p.set("status", filterStatus);
      if (filterPriority) p.set("priority", filterPriority);
      return apiFetch(`/api/tickets?${p.toString()}`);
    },
  });

  const tickets  = ticketsData?.tickets ?? [];
  const workload = workloadData?.workload ?? [];
  const maxActive = Math.max(...workload.map((w) => w.active), 1);

  const catMax = stats ? Math.max(...Object.values(stats.byCategory), 1) : 1;
  const priMax = stats ? Math.max(...Object.values(stats.byPriority), 1) : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard Admin</h1>
          <p className="text-sm text-gray-400 mt-0.5">Vista completa de todos los tickets</p>
        </div>
        <button
          onClick={onCreateClick}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
        >
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <StatCard label="Total"        value={stats.total}                    icon={<Ticket size={16} />}       color="#6b7280" />
          <StatCard label="Abiertos"     value={stats.byStatus.abierto}         icon={<AlertCircle size={16} />}  color="#3b82f6" />
          <StatCard label="En Progreso"  value={stats.byStatus.en_progreso}     icon={<Clock size={16} />}        color="#f59e0b" />
          <StatCard label="En Revisión"  value={stats.byStatus.en_revision}     icon={<BarChart3 size={16} />}    color="#8b5cf6" />
          <StatCard label="Resueltos"    value={stats.resolved}                 icon={<CheckCircle2 size={16} />} color="#10b981" />
          <StatCard label="Sin asignar"  value={stats.unassigned}               icon={<UserCheck size={16} />}    color="#ef4444" sub={stats.unassigned > 0 ? "requieren atención" : undefined} />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Workload por analista */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Carga por analista</h2>
          </div>
          {workload.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin datos</p>
          ) : (
            <div className="space-y-4">
              {workload.map((w) => (
                <div key={String(w._id ?? "unassigned")}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-sm font-medium text-gray-800">{w.name}</span>
                      {w.area && <span className="text-xs text-gray-400 ml-2">{w.area}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="text-blue-600 font-medium">{w.abierto} ab</span>
                      <span className="text-amber-500 font-medium">{w.en_progreso} prog</span>
                      <span className="text-purple-500 font-medium">{w.en_revision} rev</span>
                      <span className="text-gray-400">/ {w.total} total</span>
                    </div>
                  </div>
                  <MiniBar value={w.active} max={maxActive} color="#3b82f6" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Por categoría y prioridad */}
        <div className="space-y-4">
          {stats && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={16} className="text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-700">Por categoría</h2>
                </div>
                <div className="space-y-3">
                  {TICKET_CATEGORIES.map((cat) => {
                    const val = stats.byCategory[cat.value] ?? 0;
                    return (
                      <div key={cat.value}>
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>{cat.icon} {cat.label}</span>
                        </div>
                        <MiniBar value={val} max={catMax} color="#dc2626" />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle size={16} className="text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-700">Por prioridad</h2>
                </div>
                <div className="space-y-3">
                  {TICKET_PRIORITIES.map((pri) => {
                    const val = stats.byPriority[pri.value] ?? 0;
                    return (
                      <div key={pri.value}>
                        <div className="flex justify-between text-xs mb-1">
                          <span style={{ color: pri.color }} className="font-medium">{pri.label}</span>
                        </div>
                        <MiniBar value={val} max={priMax} color={pri.color} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ticket list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-gray-700">Todos los tickets ({tickets.length})</p>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar…"
                className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-500 w-40"
              />
            </div>
            {[
              { value: "abierto,en_progreso,en_revision", label: "Activos" },
              { value: "resuelto", label: "Resueltos" },
              { value: "cerrado", label: "Cerrados" },
              { value: "", label: "Todos" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilterStatus(opt.value)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition border ${
                  filterStatus === opt.value
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-600"
            >
              <option value="">Toda prioridad</option>
              {TICKET_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
        <TicketList tickets={tickets} isLoading={isLoading} onCreateClick={onCreateClick} />
      </div>
    </div>
  );
}

// ── Analista Dashboard ───────────────────────────────

function AnalistaDashboard({ onCreateClick }: { onCreateClick: () => void }) {
  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState("abierto,en_progreso,en_revision");

  const { data: stats } = useQuery<Stats>({
    queryKey: ["ticket-stats"],
    queryFn: () => apiFetch("/api/tickets/stats"),
    refetchInterval: 30_000,
  });

  const { data: ticketsData, isLoading } = useQuery<{ tickets: TicketRow[] }>({
    queryKey: ["tickets", search, filterStatus],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set("q", search);
      if (filterStatus) p.set("status", filterStatus);
      return apiFetch(`/api/tickets?${p.toString()}`);
    },
  });

  const tickets = ticketsData?.tickets ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mis Tickets</h1>
          <p className="text-sm text-gray-400 mt-0.5">Tickets asignados a ti o creados por ti</p>
        </div>
        <button
          onClick={onCreateClick}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
        >
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Mis tickets"    value={stats.total}               icon={<Ticket size={18} />}       color="#6b7280" />
          <StatCard label="Abiertos"       value={stats.open}                icon={<AlertCircle size={18} />}  color="#3b82f6" />
          <StatCard label="En Progreso"    value={stats.byStatus.en_progreso} icon={<Clock size={18} />}       color="#f59e0b" />
          <StatCard label="Resueltos"      value={stats.resolved}            icon={<CheckCircle2 size={18} />} color="#10b981" />
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tickets..."
            className="w-full pl-9 pr-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Tickets ({tickets.length})</p>
        </div>
        <TicketList tickets={tickets} isLoading={isLoading} onCreateClick={onCreateClick} />
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────

export default function DashboardPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { data: session }           = useSession();
  const role = (session?.user as { role?: string })?.role;

  return (
    <>
      {role === "admin"
        ? <AdminDashboard onCreateClick={() => setShowCreate(true)} />
        : <AnalistaDashboard onCreateClick={() => setShowCreate(true)} />
      }
      {showCreate && <CreateTicketModal onClose={() => setShowCreate(false)} />}
    </>
  );
}
