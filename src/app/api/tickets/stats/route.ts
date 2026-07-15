import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import { Ticket } from "@/models/Ticket";

/** GET /api/tickets/stats — aggregated ticket statistics */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  await dbConnect();

  const allActive = await Ticket.find({ isActive: true }).lean();

  const byStatus    = { abierto: 0, en_progreso: 0, en_revision: 0, resuelto: 0, cerrado: 0 };
  const byPriority  = { baja: 0, media: 0, alta: 0, critica: 0 };
  const byCategory  = { analisis: 0, insights: 0, estrategia: 0, datos: 0, reporte: 0, soporte: 0, otro: 0 };
  let unassigned = 0;

  for (const t of allActive) {
    if (t.status in byStatus)    byStatus[t.status as keyof typeof byStatus]++;
    if (t.priority in byPriority) byPriority[t.priority as keyof typeof byPriority]++;
    if (t.category in byCategory) byCategory[t.category as keyof typeof byCategory]++;
    if (!t.assignedTo && t.status !== "cerrado") unassigned++;
  }

  const openCount = byStatus.abierto + byStatus.en_progreso + byStatus.en_revision;

  return NextResponse.json({
    total:  allActive.length,
    open:   openCount,
    closed: byStatus.cerrado,
    resolved: byStatus.resuelto,
    unassigned,
    byStatus,
    byPriority,
    byCategory,
  });
}
