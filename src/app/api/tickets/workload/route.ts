import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import { Ticket } from "@/models/Ticket";

/** GET /api/tickets/workload — carga de tickets por analista (solo admin) */
export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (role !== "admin") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

  await dbConnect();

  const workload = await Ticket.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: "$assignedTo",
        total:       { $sum: 1 },
        abierto:     { $sum: { $cond: [{ $eq: ["$status", "abierto"] },     1, 0] } },
        en_progreso: { $sum: { $cond: [{ $eq: ["$status", "en_progreso"] }, 1, 0] } },
        en_revision: { $sum: { $cond: [{ $eq: ["$status", "en_revision"] }, 1, 0] } },
        resuelto:    { $sum: { $cond: [{ $eq: ["$status", "resuelto"] },    1, 0] } },
        cerrado:     { $sum: { $cond: [{ $eq: ["$status", "cerrado"] },     1, 0] } },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        name:        { $ifNull: ["$user.name",  "Sin asignar"] },
        email:       { $ifNull: ["$user.email", ""] },
        area:        { $ifNull: ["$user.area",  ""] },
        total:       1,
        abierto:     1,
        en_progreso: 1,
        en_revision: 1,
        resuelto:    1,
        cerrado:     1,
        active:      { $add: ["$abierto", "$en_progreso", "$en_revision"] },
      },
    },
    { $sort: { active: -1, total: -1 } },
  ]);

  return NextResponse.json({ workload });
}
