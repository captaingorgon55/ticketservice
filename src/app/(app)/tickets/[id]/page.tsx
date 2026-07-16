"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft, Send, Loader2, Clock, CheckCircle2,
  AlertCircle, MessageSquare, FileText, PenLine, Link as LinkIcon, Target, CalendarDays, Copy, Users, Bot, User,
} from "lucide-react";
// CalendarDays y Target importados para uso futuro
import { TICKET_STATUSES, TICKET_PRIORITIES, TICKET_CATEGORIES } from "@/lib/constants";

// ── Types ───────────────────────────────────────────

interface UserRef {
  _id: string; name: string; email: string; role: string; isActive?: boolean;
}

interface Comment {
  _id: string;
  author: UserRef;
  content: string;
  type: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface TicketDetail {
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
  aiSuggestion: string | null;
  resolution: string | null;
  createdAt: string;
  // ── Campos de solicitud de publicación ──
  journalistName?: string | null;
  objective?: string | null;
  strategicTiming?: string | null;
  baseText?: string | null;
  mustInclude?: string | null;
  supportingMaterials?: string | null;
  attachments?: { name: string; url: string; fileType: string }[];
  participants?: UserRef[];
}

// ── Helpers ─────────────────────────────────────────

async function apiFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return {}; }
}

function getActivityStyle(content: string, type: string) {
  if (type !== "system") return { icon: <MessageSquare size={13} />, bg: "bg-red-50 text-red-500", label: null };
  if (content.includes("Estado:"))           return { icon: <Clock size={13} />,        bg: "bg-blue-50 text-blue-500",   label: "Estado" };
  if (content.includes("Asignado:"))         return { icon: <User size={13} />,         bg: "bg-amber-50 text-amber-500", label: "Asignación" };
  if (content.includes("Prioridad:"))        return { icon: <AlertCircle size={13} />,  bg: "bg-orange-50 text-orange-500", label: "Prioridad" };
  if (content.includes("Participante"))      return { icon: <Users size={13} />,        bg: "bg-purple-50 text-purple-500", label: "Participante" };
  if (content.includes("adjunto") || content.includes("📎")) return { icon: <FileText size={13} />, bg: "bg-green-50 text-green-500", label: "Archivo" };
  if (content.includes("creado"))            return { icon: <CheckCircle2 size={13} />, bg: "bg-gray-100 text-gray-500",   label: "Creación" };
  return { icon: <Bot size={13} />, bg: "bg-gray-100 text-gray-400", label: "Sistema" };
}

function CommentInput({
  onSubmit, isPending,
}: {
  onSubmit: (content: string, files: File[]) => Promise<void>;
  isPending: boolean;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && files.length === 0) return;
    setUploading(true);
    try {
      await onSubmit(text.trim(), files);
      setText("");
      setFiles([]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe una observación..."
          className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <button
          type="submit"
          disabled={(!text.trim() && files.length === 0) || isPending || uploading}
          className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-2"
        >
          {(isPending || uploading) ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Enviar
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="file"
          multiple
          onChange={(e) => setFiles(f => [...f, ...Array.from(e.target.files ?? [])])}
          className="text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-600 hover:file:bg-gray-200"
        />
        {files.map((f, i) => (
          <span key={i} className="text-xs bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1">
            {f.name}
            <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">✕</button>
          </span>
        ))}
      </div>
    </form>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Page ────────────────────────────────────────────

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: sessionData } = useSession();
  const isAdmin = (sessionData?.user as { role?: string })?.role === "admin";

  const deleteMut = useMutation({
    mutationFn: () => apiFetch(`/api/tickets/${id}`, { method: "DELETE" }),
    onSuccess: () => router.push("/"),
  });

  function copyTicketNumber(num: number) {
    navigator.clipboard.writeText(String(num));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const { data, isLoading } = useQuery<{ ticket: TicketDetail; comments: Comment[] }>({
    queryKey: ["ticket", id],
    queryFn: () => apiFetch(`/api/tickets/${id}`),
    refetchInterval: 15_000,
  });

  const { data: usersData } = useQuery<{ users: UserRef[] }>({
    queryKey: ["assignable-users"],
    queryFn: () => apiFetch("/api/tickets/assignable-users"),
  });

  const commentMut = useMutation({
    mutationFn: (body: { content: string; attachments?: { name: string; url: string; fileType: string }[] }) =>
      apiFetch(`/api/tickets/${id}/comments`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket", id] }),
  });

  const updateMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/tickets/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket", id] }),
  });

  async function handleUploadAttachments() {
    if (newFiles.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(newFiles.map(async (file) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("ticketNumber", String(ticket.ticketNumber));
        fd.append("ticketTitle", ticket.title);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json() as { url?: string; error?: string };
        if (!res.ok || !data.url) throw new Error(data.error ?? "Error al subir");
        return { name: file.name, url: data.url, fileType: file.type };
      }));
      await updateMut.mutateAsync({ addAttachments: uploaded });
      setNewFiles([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al subir archivos");
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Ticket no encontrado</p>
        <button onClick={() => router.push("/")} className="text-sm text-red-600 mt-2">Volver al dashboard</button>
      </div>
    );
  }

  const { ticket, comments } = data;
  const users = usersData?.users ?? [];
  const catInfo = TICKET_CATEGORIES.find((c) => c.value === ticket.category);
  const statusInfo = TICKET_STATUSES.find((s) => s.value === ticket.status);
  const priorityInfo = TICKET_PRIORITIES.find((p) => p.value === ticket.priority);
  const isPublicationRequest = ticket.source === "solicitud_publicacion";
  let aiSuggestion: { approach?: string; steps?: string[]; tools?: string[]; estimatedEffort?: string; keyInsight?: string; suggestedPriority?: string } | null = null;
  if (ticket.aiSuggestion) {
    try { aiSuggestion = JSON.parse(ticket.aiSuggestion); } catch { /* ignore */ }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Back */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition"
        >
          <ArrowLeft size={16} />
          Volver al dashboard
        </button>
        {isAdmin && !confirmDelete && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
          >
            🗑 Eliminar ticket
          </button>
        )}
        {isAdmin && confirmDelete && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">¿Confirmar eliminación?</span>
            <button
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50"
            >
              {deleteMut.isPending ? "Eliminando…" : "Sí, eliminar"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 fade-in">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <button
                onClick={() => copyTicketNumber(ticket.ticketNumber)}
                className="flex items-center gap-1 text-xs font-mono text-gray-400 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition"
                title="Copiar número"
              >
                #{ticket.ticketNumber}
                {copied ? <CheckCircle2 size={11} className="text-green-500" /> : <Copy size={11} />}
              </button>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                {catInfo?.icon} {catInfo?.label}
              </span>
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ background: priorityInfo?.color ? `${priorityInfo.color}15` : "#f0f0f0", color: priorityInfo?.color ?? "#666" }}
              >
                {priorityInfo?.label}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{ticket.title}</h1>
              {isPublicationRequest && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 mt-2 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <PenLine size={12} />
                  Solicitud de publicación
                </span>
              )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={ticket.status}
              onChange={(e) => updateMut.mutate({ status: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {TICKET_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>

        {/* ── Brief fields (solicitud de publicación) ── */}
        {isPublicationRequest && (
          <div className="mt-6 space-y-4 bg-amber-50/40 border border-amber-100 rounded-xl p-5">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
              <FileText size={13} />
              Detalles de la solicitud
            </p>
            <div className="grid gap-4">
              {ticket.journalistName && (
                <div>
                  <p className="text-xs font-medium text-amber-600 flex items-center gap-1 mb-0.5">
                    <PenLine size={11} /> Periodista solicitante
                  </p>
                  <p className="text-sm text-gray-800">{ticket.journalistName}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-amber-600 flex items-center gap-1 mb-0.5">
                  <Target size={11} /> ¿Qué queremos comunicar?
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
              </div>
              {ticket.strategicTiming && (
                <div>
                  <p className="text-xs font-medium text-amber-600 flex items-center gap-1 mb-0.5">
                    <CalendarDays size={11} /> ¿Cuándo publicar?
                  </p>
                  <p className="text-sm text-gray-700">{ticket.strategicTiming}</p>
                </div>
              )}
              {ticket.baseText && (
                <div>
                  <p className="text-xs font-medium text-amber-600 flex items-center gap-1 mb-0.5">
                    <FileText size={11} /> Texto base
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded-lg p-3 border border-amber-100">{ticket.baseText}</p>
                </div>
              )}
              {ticket.mustInclude && (
                <div>
                  <p className="text-xs font-medium text-amber-600 flex items-center gap-1 mb-0.5">
                    <AlertCircle size={11} /> No dejar por fuera
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.mustInclude}</p>
                </div>
              )}
              {ticket.supportingMaterials && (
                <div>
                  <p className="text-xs font-medium text-amber-600 flex items-center gap-1 mb-0.5">
                    <LinkIcon size={11} /> Información de apoyo
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.supportingMaterials}</p>
                </div>
              )}
              {ticket.attachments && ticket.attachments.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">📎 Archivos adjuntos</p>
                  <div className="flex flex-wrap gap-2">
                    {ticket.attachments.map((a, i) => (
                      <a
                        key={i}
                        href={a.url.startsWith("/api/files/") ? a.url : `/api/download?u=${encodeURIComponent(a.url)}&n=${encodeURIComponent(a.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition"
                      >
                        📎 {a.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Meta info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400 mb-1">Creado por</p>
            <p className="text-sm font-medium text-gray-700">{ticket.createdBy.name}</p>
            <p className="text-xs text-gray-400">{formatDate(ticket.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Asignado a</p>
            <select
              value={ticket.assignedTo?._id ?? ""}
              onChange={(e) => updateMut.mutate({ assignedTo: e.target.value || null })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            >
              <option value="">Sin asignar</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Prioridad</p>
            <select
              value={ticket.priority}
              onChange={(e) => updateMut.mutate({ priority: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            >
              {TICKET_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Categoría</p>
            <select
              value={ticket.category}
              onChange={(e) => updateMut.mutate({ category: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            >
              {TICKET_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Participantes */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 fade-in">
        <div className="flex items-center gap-2 mb-3">
          <Users size={15} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Participantes</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {(ticket.participants ?? []).length === 0 ? (
            <span className="text-xs text-gray-400">Sin participantes adicionales</span>
          ) : (
            (ticket.participants ?? []).map((p) => (
              <span key={p._id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700">
                {p.name}
                <button
                  onClick={() => {
                    const ids = (ticket.participants ?? []).filter((x) => x._id !== p._id).map((x) => x._id);
                    updateMut.mutate({ participants: ids });
                  }}
                  className="text-blue-400 hover:text-blue-700"
                >✕</button>
              </span>
            ))
          )}
        </div>
        <select
          onChange={(e) => {
            if (!e.target.value) return;
            const current = (ticket.participants ?? []).map((p) => p._id);
            if (!current.includes(e.target.value)) {
              updateMut.mutate({ participants: [...current, e.target.value] });
            }
            e.target.value = "";
          }}
          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500"
          defaultValue=""
        >
          <option value="">+ Agregar participante</option>
          {users.filter((u) => !(ticket.participants ?? []).find((p) => p._id === u._id) && u._id !== ticket.assignedTo?._id).map((u) => (
            <option key={u._id} value={u._id}>{u.name}</option>
          ))}
        </select>
      </div>

      {/* Adjuntos */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden fade-in">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">📎 Archivos adjuntos</span>
        </div>
        <div className="p-5 space-y-3">
          {ticket.attachments && ticket.attachments.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {ticket.attachments.map((a, i) => (
                <a
                  key={i}
                  href={a.url.startsWith("/api/files/") ? a.url : `/api/download?u=${encodeURIComponent(a.url)}&n=${encodeURIComponent(a.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition"
                >
                  📎 {a.name}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Sin archivos adjuntos</p>
          )}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-50">
            <input
              type="file"
              multiple
              onChange={(e) => setNewFiles(Array.from(e.target.files ?? []))}
              className="flex-1 text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-600 hover:file:bg-gray-200"
            />
            {newFiles.length > 0 && (
              <button
                onClick={handleUploadAttachments}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
              >
                {uploading ? <Loader2 size={12} className="animate-spin" /> : null}
                {uploading ? "Subiendo…" : `Subir ${newFiles.length} archivo(s)`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Comments timeline */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden fade-in">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">Actividad ({comments.length})</span>
        </div>

        <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {comments.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare size={24} className="mx-auto text-gray-300 mb-2" />
              <p className="text-xs text-gray-400">Sin actividad registrada</p>
            </div>
          ) : (
            comments.map((comment) => {
              const isSystem = comment.type === "system";
              const { icon, bg, label } = getActivityStyle(comment.content, comment.type);
              const lines = comment.content?.split("\n").filter(Boolean) ?? [];
              return (
                <div key={comment._id} className="px-5 py-3.5 flex gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${bg}`}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-gray-700">
                        {isSystem ? (label ?? "Sistema") : comment.author?.name ?? "Usuario"}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
                    </div>
                    {isSystem ? (
                      <div className="space-y-1">
                        {lines.map((line, i) => (
                          <p key={i} className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1 inline-block mr-1 mb-1">
                            {line}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <>
                        {comment.content && <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>}
                        {(comment.metadata?.attachments as { name: string; url: string }[] | undefined)?.map((a, i) => (
                          <a key={i} href={a.url.startsWith("/api/files/") ? a.url : `/api/download?u=${encodeURIComponent(a.url)}&n=${encodeURIComponent(a.name)}`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline mt-1 mr-2">
                            📎 {a.name}
                          </a>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Comment input */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 fade-in">
        <CommentInput
          onSubmit={async (content, files) => {
            let attachments: { name: string; url: string; fileType: string }[] = [];
            if (files.length > 0) {
              attachments = await Promise.all(files.map(async (f) => {
                const fd = new FormData();
                fd.append("file", f);
                fd.append("ticketNumber", String(ticket.ticketNumber));
                fd.append("ticketTitle", ticket.title);
                const res = await fetch("/api/upload", { method: "POST", body: fd });
                const data = await res.json() as { url?: string; error?: string };
                if (!data.url) throw new Error(data.error ?? "Error al subir");
                return { name: f.name, url: data.url, fileType: f.type };
              }));
            }
            await commentMut.mutateAsync({ content, attachments });
          }}
          isPending={commentMut.isPending}
        />
      </div>
    </div>
  );
}
