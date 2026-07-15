import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import { Ticket } from "@/models/Ticket";
import { TicketComment } from "@/models/TicketComment";
import { notifyTicketActivity, esc } from "@/lib/email";

async function requireAuth() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  return session;
}

/** GET /api/tickets/[id] — ticket detail + comments */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth();
  if (denied instanceof NextResponse) return denied;

  const { id } = await params;
  await dbConnect();

  const ticket = await Ticket.findById(id)
    .populate("createdBy", "name email role")
    .populate("assignedTo", "name email role")
    .lean();

  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  const comments = await TicketComment.find({ ticket: id })
    .sort({ createdAt: 1 })
    .populate("author", "name email role")
    .lean();

  return NextResponse.json({ ticket, comments });
}

/** PATCH /api/tickets/[id] — update ticket fields */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const userId = (session.user as { id?: string })?.id;
  const { id } = await params;

  const body = await req.json();
  const { status, priority, assignedTo, title, description, category, tags, dueDate, resolution,
    journalistName, objective, strategicTiming, baseText, mustInclude, supportingMaterials } =
    body as Record<string, unknown>;

  await dbConnect();
  const ticket = await Ticket.findById(id);
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  const changes: string[] = [];

  if (status !== undefined && typeof status === "string") {
    const valid = ["abierto", "en_progreso", "en_revision", "resuelto", "cerrado"];
    if (!valid.includes(status)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }
    if (ticket.status !== status) {
      changes.push(`Estado: ${ticket.status} → ${status}`);
      ticket.status = status as typeof ticket.status;
      if (status === "resuelto") ticket.resolvedAt = new Date();
      if (status === "cerrado" || status === "abierto") ticket.resolvedAt = null;
    }
  }

  if (priority !== undefined && typeof priority === "string") {
    const valid = ["baja", "media", "alta", "critica"];
    if (!valid.includes(priority)) {
      return NextResponse.json({ error: "Prioridad inválida" }, { status: 400 });
    }
    if (ticket.priority !== priority) {
      changes.push(`Prioridad: ${ticket.priority} → ${priority}`);
      ticket.priority = priority as typeof ticket.priority;
    }
  }

  if (assignedTo !== undefined) {
    const prev = ticket.assignedTo ? String(ticket.assignedTo) : "sin asignar";
    const next = assignedTo ? String(assignedTo) : "sin asignar";
    if (prev !== next) {
      changes.push(`Asignado: ${prev} → ${next}`);
      ticket.assignedTo = assignedTo ? (assignedTo as string) : null;
    }
  }

  if (title !== undefined && typeof title === "string" && title.trim()) ticket.title = title.trim();
  if (description !== undefined && typeof description === "string" && description.trim()) ticket.description = description.trim();
  if (category !== undefined && typeof category === "string") {
    const valid = ["analisis", "insights", "estrategia", "datos", "reporte", "soporte", "otro"];
    if (!valid.includes(category)) return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
    if (ticket.category !== category) { changes.push(`Categoría: ${ticket.category} → ${category}`); ticket.category = category as typeof ticket.category; }
  }
  if (tags !== undefined && Array.isArray(tags)) ticket.tags = tags;
  if (dueDate !== undefined) ticket.dueDate = dueDate ? new Date(dueDate as string) : null;
  if (resolution !== undefined && typeof resolution === "string") ticket.resolution = resolution.trim() || null;
  if (journalistName !== undefined && typeof journalistName === "string") ticket.journalistName = journalistName.trim() || null;
  if (objective !== undefined && typeof objective === "string") ticket.objective = objective.trim() || null;
  if (strategicTiming !== undefined && typeof strategicTiming === "string") ticket.strategicTiming = strategicTiming.trim() || null;
  if (baseText !== undefined && typeof baseText === "string") ticket.baseText = baseText.trim() || null;
  if (mustInclude !== undefined && typeof mustInclude === "string") ticket.mustInclude = mustInclude.trim() || null;
  if (supportingMaterials !== undefined && typeof supportingMaterials === "string") ticket.supportingMaterials = supportingMaterials.trim() || null;

  await ticket.save();

  if (changes.length > 0) {
    await TicketComment.create({
      ticket: ticket._id,
      author: userId,
      content: changes.join("\n"),
      type: "system",
      metadata: { action: "updated", changes },
    });
  }

  const populated = await Ticket.findById(ticket._id)
    .populate("createdBy", "name email role")
    .populate("assignedTo", "name email role")
    .lean();

  // ── Notificar por correo si hubo cambios ──
  if (changes.length > 0) {
    const updaterName = session.user?.name ?? "—";
    const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
    notifyTicketActivity({
      subject: `✏️ Ticket #${ticket.ticketNumber} actualizado: ${ticket.title}`,
      ticketNumber: ticket.ticketNumber,
      ticketTitle: ticket.title,
      ticketUrl: `${APP_URL}/tickets/${id}`,
      bodyHtml: `
        <p style="font-size:13px;color:#666;margin:0 0 8px;">Actualizado por <strong style="color:#333;">${esc(updaterName)}</strong></p>
        <div style="padding:12px;background:#f9fafb;border-radius:8px;font-size:13px;color:#333;line-height:1.6;">${changes.map(c => esc(c)).join("<br>")}</div>
      `,
    });
  }

  return NextResponse.json({ ticket: populated });
}
