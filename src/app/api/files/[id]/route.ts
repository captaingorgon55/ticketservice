import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import { FileAttachment } from "@/models/FileAttachment";

/** GET /api/files/[id] — sirve un archivo almacenado en MongoDB */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return new NextResponse("No autenticado", { status: 401 });

  const { id } = await params;
  await dbConnect();

  const file = await FileAttachment.findById(id).lean() as {
    name: string; contentType: string; data: Buffer;
  } | null;

  if (!file) return new NextResponse("Archivo no encontrado", { status: 404 });

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type":        file.contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
      "Cache-Control":       "private, max-age=3600",
    },
  });
}
