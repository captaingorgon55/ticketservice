import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import { Ticket, getNextTicketNumber } from "@/models/Ticket";
import { TicketComment } from "@/models/TicketComment";
import { notifyTicketActivity, esc } from "@/lib/email";
import { User } from "@/models/User";
import { getJsonModel } from "@/lib/gemini";

// ── AI auto-assignment ──────────────────────────────

async function aiAutoAssign(ticket: {
  title: string;
  description: string;
  category: string;
}): Promise<{ userId: string; userName: string; reason: string } | null> {
  try {
    const analysts = await User.find({ isActive: true, role: "analista" })
      .select("_id name area")
      .lean();

    if (analysts.length === 0) return null;

    // Get open ticket count per analyst
    const workload = await Promise.all(
      analysts.map(async (a) => {
        const open = await Ticket.countDocuments({
          assignedTo: a._id,
          isActive: true,
          status: { $in: ["abierto", "en_progreso", "en_revision"] },
        });
        return { id: String(a._id), name: a.name, area: a.area ?? "", open };
      })
    );

    const model = getJsonModel("gemini-2.5-flash");
    const prompt = `Eres un sistema de asignación de tickets de help desk para el equipo de Inteligencia de Mercados de un periódico.

Ticket a asignar:
- Título: ${ticket.title}
- Categoría: ${ticket.category}
- Descripción: ${ticket.description}

Analistas disponibles:
${workload.map((w) => `- ID: ${w.id} | Nombre: ${w.name} | Área: ${w.area} | Tickets activos: ${w.open}`).join("\n")}

Asigna el ticket al analista más adecuado según:
1. Relevancia del área con el tipo de ticket
2. Menor carga de trabajo actual
3. Especialización en la categoría

Responde SOLO con este JSON (sin markdown):
{"userId":"<id_del_analista>","userName":"<nombre>","reason":"<razón breve en español>"}`;

    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text()) as {
      userId: string;
      userName: string;
      reason: string;
    };

    const valid = workload.find((w) => w.id === parsed.userId);
    if (!valid) return null;

    return parsed;
  } catch (err) {
    console.error("[auto-assign] Error:", err instanceof Error ? err.message : err);
    return null;
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
  const status   = searchParams.get("status");
  const category = searchParams.get("category");
  const priority = searchParams.get("priority");
  const assigned = searchParams.get("assignedTo");
  const created  = searchParams.get("createdBy");
  const q        = searchParams.get("q");
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit    = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));

  await dbConnect();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = { isActive: true };

  // Analistas ven tickets que les asignaron O que ellos crearon
  if (role !== "admin") {
    filter.$or = [{ assignedTo: userId }, { createdBy: userId }];
  } else {
    if (assigned) filter.assignedTo = assigned === "unassigned" ? null : assigned;
  }

  if (status)   filter.status   = { $in: status.split(",") };
  if (category) filter.category = { $in: category.split(",") };
  if (priority) filter.priority = { $in: priority.split(",") };
  if (created)  filter.createdBy  = created;
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
  } = body as {
    title?: string; description?: string; category?: string; source?: string;
    assignedTo?: string | null; tags?: string[]; dueDate?: string | null;
    journalistName?: string; objective?: string; strategicTiming?: string;
    baseText?: string; mustInclude?: string; supportingMaterials?: string;
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
