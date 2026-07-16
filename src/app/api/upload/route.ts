import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import { FileAttachment } from "@/models/FileAttachment";

export const maxDuration = 60;

/** POST /api/upload — guarda el archivo en MongoDB y retorna una URL de descarga interna */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const formData     = await req.formData();
  const file         = formData.get("file")         as File   | null;
  const ticketNumber = formData.get("ticketNumber") as string | null;

  if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Archivo demasiado grande (máx 20 MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await dbConnect();
    const attachment = await FileAttachment.create({
      ticketId:    ticketNumber ? `ticket-${ticketNumber}` : "general",
      name:        file.name,
      contentType: file.type || "application/octet-stream",
      size:        file.size,
      data:        buffer,
    });

    const url = `/api/files/${attachment._id}`;
    console.log(`[upload] ${file.name} (${Math.round(file.size / 1024)} KB) → MongoDB ${attachment._id}`);
    return NextResponse.json({ url, name: file.name, fileType: file.type });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[upload] Error:", msg);
    return NextResponse.json({ error: `Error al guardar archivo: ${msg.slice(0, 150)}` }, { status: 500 });
  }
}
