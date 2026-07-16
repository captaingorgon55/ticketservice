"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Send, Bot, Loader2, User, Clock, CheckCircle2,
  AlertCircle, MessageSquare, Sparkles, FileText, PenLine, Link as LinkIcon, Target, CalendarDays,
} from "lucide-react";
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
  attachments?: { name: string; url: string; type: string }[];
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
  return res.json();
}

function getCommentIcon(type: string) {
  switch (type) {
    case "system":       return <Bot size={14} />;
    case "status_change":return <Clock size={14} />;
    case "assignment":   return <User size={14} />;
    case "resolution":   return <CheckCircle2 size={14} />;
    default:             return <MessageSquare size={14} />;
  }
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
  const [showAISuggest, setShowAISuggest] = useState(false);

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
    mutationFn: (content: string) =>
      apiFetch(`/api/tickets/${id}/comments`, { method: "POST", body: JSON.stringify({ content }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      setNewComment("");
    },
  });

  const updateMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/tickets/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket", id] }),
  });

  const aiSuggestMut = useMutation({
    mutationFn: () => apiFetch(`/api/tickets/${id}/ai-suggest`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      setShowAISuggest(false);
    },
  });

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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition"
      >
        <ArrowLeft size={16} />
        Volver al dashboard
      </button>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 fade-in">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded">
                #{ticket.ticketNumber}
              </span>
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
                        href={a.url}
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

      {/* AI Suggestion */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden fade-in">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-violet-500" />
            <span className="text-sm font-semibold text-gray-700">Asistente IA</span>
          </div>
          {!aiSuggestion && (
            <button
              onClick={() => aiSuggestMut.mutate()}
              disabled={aiSuggestMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
            >
              {aiSuggestMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}
              {aiSuggestMut.isPending ? "Analizando…" : "Analizar con IA"}
            </button>
          )}
        </div>
        {aiSuggestion ? (
          <div className="p-5 space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Enfoque</p>
              <p className="text-gray-700">{aiSuggestion.approach}</p>
            </div>
            {aiSuggestion.steps && aiSuggestion.steps.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Pasos sugeridos</p>
                <ol className="list-decimal list-inside space-y-1.5">
                  {aiSuggestion.steps.map((step, i) => (
                    <li key={i} className="text-gray-600">{step}</li>
                  ))}
                </ol>
              </div>
            )}
            {aiSuggestion.tools && aiSuggestion.tools.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Herramientas / Fuentes</p>
                <div className="flex flex-wrap gap-2">
                  {aiSuggestion.tools.map((tool, i) => (
                    <span key={i} className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded text-xs">{tool}</span>
                  ))}
                </div>
              </div>
            )}
            {aiSuggestion.keyInsight && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs font-semibold text-amber-700 mb-0.5">💡 Consideración clave</p>
                <p className="text-xs text-amber-800">{aiSuggestion.keyInsight}</p>
              </div>
            )}
            {aiSuggestion.estimatedEffort && (
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>
                  Esfuerzo estimado: <strong className={
                    aiSuggestion.estimatedEffort === "baja" ? "text-green-600" :
                    aiSuggestion.estimatedEffort === "alta" ? "text-red-600" : "text-amber-600"
                  }>{aiSuggestion.estimatedEffort}</strong>
                </span>
                {aiSuggestion.suggestedPriority && (
                  <span>
                    Prioridad sugerida: <strong>{aiSuggestion.suggestedPriority}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center">
            <Bot size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">Presiona "Analizar con IA" para obtener una recomendación</p>
          </div>
        )}
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
            comments.map((comment) => (
              <div key={comment._id} className="px-5 py-3.5 flex gap-3">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    comment.type === "system"
                      ? "bg-gray-100 text-gray-400"
                      : "bg-red-50 text-red-500"
                  }`}
                >
                  {getCommentIcon(comment.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-gray-700">
                      {comment.type === "system" ? "Sistema" : comment.author.name}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{comment.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Comment input */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newComment.trim()) commentMut.mutate(newComment);
          }}
          className="flex gap-3"
        >
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Añade un comentario..."
            className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
          <button
            type="submit"
            disabled={!newComment.trim() || commentMut.isPending}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-2"
          >
            {commentMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
