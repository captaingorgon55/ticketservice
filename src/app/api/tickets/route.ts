import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import { Ticket, getNextTicketNumber } from "@/models/Ticket";
import { TicketComment } from "@/models/TicketComment";
import { notifyTicketActivity, esc } from "@/lib/email";
import { User } from "@/models/User";
import { getJsonModel } from "@/lib/gemini";

// ── Helpers ─────────────────────────────────────────

function isRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("quota") || msg.includes("429") || msg.includes("rate") || msg.includes("retry");
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 8000): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i < retries && isRateLimit(err)) {
        console.log(`[gemini] Rate limit — reintentando en ${delayMs / 1000}s (intento ${i + 1}/${retries})`);
        await sleep(delayMs);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

// ── AI auto-assignment ──────────────────────────────

type AssignResult = { userId: string; userName: string; reason: string };

async function getWorkload() {
  const analysts = await User.find({ isActive: true, role: "analista" })
    .select("_id name area").lean();

  return Promise.all(
    analysts.map(async (a) => {
      const open = await Ticket.countDocuments({
        assignedTo: a._id, isActive: true,
        status: { $in: ["abierto", "en_progreso", "en_revision"] },
      });
      return { id: String(a._id), name: String(a.name), area: String(a.area ?? ""), open };
    })
  );
}

function fallbackAssign(workload: { id: string; name: string; open: number }[]): AssignResult | null {
  if (workload.length === 0) return null;
  const least = [...workload].sort((a, b) => a.open - b.open)[0];
  return { userId: least.id, userName: least.name, reason: "Asignado por menor carga de trabajo" };
}

async function aiAutoAssign(ticket: {
  title: string; description: string; category: string;
}): Promise<AssignResult | null> {
  try {
    const workload = await getWorkload();
    if (workload.length === 0) return null;

    const model = getJsonModel("gemini-2.0-flash");
    const prompt = `Eres un sistema de asignación de tickets para el equipo de Inteligencia de Mercados de un periódico.

Ticket:
- Título: ${ticket.title}
- Categoría: ${ticket.category}
- Descripción: ${ticket.description}

Analistas disponibles:
${workload.map((w) => `- ID: ${w.id} | Nombre: ${w.name} | Área: ${w.area} | Tickets activos: ${w.open}`).join("\n")}

Asigna al analista más adecuado según área, especialización y menor carga.
Responde SOLO con JSON (sin markdown):
{"userId":"<id>","userName":"<nombre>","reason":"<razón breve>"}`;

    const result = await withRetry(() => model.generateContent(prompt));
    const parsed = JSON.parse(result.response.text()) as AssignResult;
    const valid = workload.find((w) => w.id === parsed.userId);
    if (!valid) return fallbackAssign(workload);
    return parsed;
  } catch (err) {
    console.error("[auto-assign] Gemini falló, usando fallback:", err instanceof Error ? err.message : err);
    try {
      const workload = await getWorkload();
      return fallbackAssign(workload);
    } catch {
      return null;
    }
  }
}

async function requireAuth() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  return session;
}

/** GET /api/tickets — list tickets with filters */
export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const userId = (session.user as { id?: string; role?: string })?.id;
  const role   = (session.user as { id?: string; role?: string })?.role;

  const { searchParams } = new URL(req.url);
  const status       = searchParams.get("status");
  const category     = searchParams.get("category");
  const priority     = searchParams.get("priority");
  const assigned     = searchParams.get("assignedTo");
  const created      = searchParams.get("createdBy");
  const q            = searchParams.get("q");
  const ticketNumber = searchParams.get("ticketNumber");
  const page         = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit        = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));

  await dbConnect();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = { isActive: true };

  // Analistas ven tickets donde son asignado, participante o creador
  if (role !== "admin") {
    filter.$or = [{ assignedTo: userId }, { participants: userId }, { createdBy: userId }];
  } else {
    if (assigned) filter.assignedTo = assigned === "unassigned" ? null : assigned;
  }

  if (ticketNumber) {
    filter.ticketNumber = parseInt(ticketNumber);
  } else {
    if (status)   filter.status   = { $in: status.split(",") };
    if (category) filter.category = { $in: category.split(",") };
    if (priority) filter.priority = { $in: priority.split(",") };
    if (created)  filter.createdBy  = created;
  }
  if (q) {
    filter.$or = [
      { title:       { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
      { tags:        { $regex: q, $options: "i" } },
    ];
  }

  const total = await Ticket.countDocuments(filter);
  const tickets = await Ticket.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("createdBy", "name email role")
    .populate("assignedTo", "name email role")
    .lean();

  return NextResponse.json({
    tickets,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

/** POST /api/tickets — create a new ticket */
export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Usuario no identificado" }, { status: 401 });

  const body = await req.json();
  const {
    title, description, category, source, assignedTo, tags, dueDate,
    journalistName, objective, strategicTiming, baseText, mustInclude, supportingMaterials,
    attachments,
  } = body as {
    title?: string; description?: string; category?: string; source?: string;
    assignedTo?: string | null; tags?: string[]; dueDate?: string | null;
    journalistName?: string; objective?: string; strategicTiming?: string;
    baseText?: string; mustInclude?: string; supportingMaterials?: string;
    attachments?: { name: string; url: string; type: string }[];
  };

  if (!title || !description || !category) {
    return NextResponse.json({ error: "title, description y category son obligatorios" }, { status: 400 });
  }

  const validCats = ["analisis", "insights", "estrategia", "datos", "reporte", "soporte", "otro"];
  if (!validCats.includes(category)) {
    return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
  }

  const validSources = ["interna", "solicitud", "solicitud_publicacion"];
  const resolvedSource = validSources.includes(source ?? "") ? source! : "interna";

  await dbConnect();
  const ticketNumber = await getNextTicketNumber();

  // Auto-asignar con IA si no se especificó un analista
  let finalAssignedTo: string | null = assignedTo || null;
  let autoAssignment: { userId: string; userName: string; reason: string } | null = null;

  if (!finalAssignedTo && process.env.GEMINI_API_KEY) {
    autoAssignment = await aiAutoAssign({
      title: title.trim(),
      description: description.trim(),
      category,
    });
    if (autoAssignment) finalAssignedTo = autoAssignment.userId;
  }

  const ticket = await Ticket.create({
    ticketNumber,
    title: title.trim(),
    description: description.trim(),
    category,
    source: resolvedSource,
    createdBy: userId,
    assignedTo: finalAssignedTo,
    tags: tags ?? [],
    dueDate: dueDate ? new Date(dueDate) : null,
    journalistName:       journalistName?.trim() || null,
    objective:            objective?.trim() || null,
    strategicTiming:      strategicTiming?.trim() || null,
    baseText:             baseText?.trim() || null,
    mustInclude:          mustInclude?.trim() || null,
    supportingMaterials:  supportingMaterials?.trim() || null,
    attachments:          attachments ?? [],
  });

  await TicketComment.create({
    ticket: ticket._id,
    author: userId,
    content: `Ticket #${ticketNumber} creado en categoría ${category}`,
    type: "system",
    metadata: { action: "created", category },
  });

  if (autoAssignment) {
    await TicketComment.create({
      ticket: ticket._id,
      author: userId,
      content: `🤖 Auto-asignado a ${autoAssignment.userName}: ${autoAssignment.reason}`,
      type: "system",
      metadata: { action: "auto-assigned", assignedTo: autoAssignment.userId },
    });
  }

  const populated = await Ticket.findById(ticket._id)
    .populate("createdBy", "name email role")
    .populate("assignedTo", "name email role")
    .lean();

  // ── Notificar por correo ──
  const creatorName = (populated as Record<string, unknown>)?.createdBy as Record<string, unknown> | null;
  const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
  notifyTicketActivity({
    subject: `🆕 Nuevo ticket #${ticketNumber}: ${title}`,
    ticketNumber,
    ticketTitle: title,
    ticketUrl: `${APP_URL}/tickets/${ticket._id}`,
    bodyHtml: `
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr><td style="padding:4px 0;color:#666;width:100px;">Creado por</td><td style="font-weight:600;">${esc(creatorName?.name as string ?? "—")}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Categoría</td><td style="font-weight:600;">${esc(category)}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Fuente</td><td style="font-weight:600;">${resolvedSource === "solicitud_publicacion" ? "Solicitud de publicación" : "Interno"}</td></tr>
        ${journalistName ? `<tr><td style="padding:4px 0;color:#666;">Periodista</td><td style="font-weight:600;">${esc(journalistName)}</td></tr>` : ""}
      </table>
      <div style="margin-top:12px;padding:12px;background:#f9fafb;border-radius:8px;font-size:13px;color:#333;line-height:1.5;">${esc(description)}</div>
    `,
  });

  return NextResponse.json({ ticket: populated }, { status: 201 });
}
