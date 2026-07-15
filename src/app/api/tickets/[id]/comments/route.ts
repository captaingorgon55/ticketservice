import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import { TicketComment } from "@/models/TicketComment";
import { Ticket } from "@/models/Ticket";
import { notifyTicketActivity, esc } from "@/lib/email";

async function requireAuth() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  return session;
}

/** GET /api/tickets/[id]/comments — list all comments for a ticket */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth();
  if (denied instanceof NextResponse) return denied;
  const { id } = await params;
  await dbConnect();
  const comments = await TicketComment.find({ ticket: id })
    .sort({ createdAt: 1 })
    .populate("author", "name email role")
    .lean();
  return NextResponse.json({ comments });
}

/** POST /api/tickets/[id]/comments — add a comment to a ticket */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Usuario no identificado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { content } = body as { content?: string };

  if (!content?.trim()) {
    return NextResponse.json({ error: "El comentario no puede estar vacío" }, { status: 400 });
  }

  await dbConnect();
  const ticket = await Ticket.findById(id)
    .populate("assignedTo", "email")
    .populate("createdBy", "email");
  if (!ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });

  const comment = await TicketComment.create({
    ticket: id,
    author: userId,
    content: content.trim(),
    type: "comment",
  });

  const populated = await TicketComment.findById(comment._id)
    .populate("author", "name email role")
    .lean();

  // ── Notificar comentario por correo ──
  const authorName = (populated as Record<string, unknown>)?.author as Record<string, unknown> | null;
  const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

  const ticketAny = ticket as unknown as Record<string, unknown>;
  const assignedUser = ticketAny.assignedTo as Record<string, unknown> | null;
  const createdByUser = ticketAny.createdBy as Record<string, unknown> | null;
  const extraRecipients = [assignedUser?.email, createdByUser?.email]
    .filter((e): e is string => typeof e === "string" && e.length > 0);

  notifyTicketActivity({
    subject: `💬 Nuevo comentario en #${ticket.ticketNumber}: ${ticket.title}`,
    ticketNumber: ticket.ticketNumber,
    ticketTitle: ticket.title,
    ticketUrl: `${APP_URL}/tickets/${id}`,
    extraRecipients,
    bodyHtml: `
      <p style="font-size:13px;color:#666;margin:0 0 4px;">
        <strong style="color:#333;">${esc(authorName?.name as string ?? "—")}</strong> comentó:
      </p>
      <div style="padding:12px;background:#f9fafb;border-radius:8px;font-size:13px;color:#333;line-height:1.5;">${esc(content)}</div>
    `,
  });

  return NextResponse.json({ comment: populated }, { status: 201 });
}
