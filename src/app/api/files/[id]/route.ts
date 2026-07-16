import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import { FileAttachment } from "@/models/FileAttachment";

const EXT_TYPES: Record<string, string> = {
  pdf:  "application/pdf",
  png:  "image/png",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  gif:  "image/gif",
  webp: "image/webp",
  doc:  "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls:  "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv:  "text/csv",
  txt:  "text/plain",
  zip:  "application/zip",
};

/** GET /api/files/[id] — sirve un archivo almacenado en MongoDB */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return new NextResponse("No autenticado", { status: 401 });

  const { id } = await params;
  await dbConnect();

  // Sin .lean() para que Mongoose hidrate correctamente el Buffer
  const file = await FileAttachment.findById(id);
  if (!file) return new NextResponse("Archivo no encontrado", { status: 404 });

  // Detectar content-type por extensión si el guardado fue vacío
  const ext  = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = (file.contentType && file.contentType !== "application/octet-stream")
    ? file.contentType
    : (EXT_TYPES[ext] ?? "application/octet-stream");

  // Convertir Buffer de Mongoose a ArrayBuffer correctamente
  const buf    = file.data as Buffer;
  const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

  return new NextResponse(arrayBuf, {
    headers: {
      "Content-Type":        mime,
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
      "Cache-Control":       "private, max-age=3600",
    },
  });
}
