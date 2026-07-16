import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const maxDuration = 60;

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME ?? "";
const API_KEY    = process.env.CLOUDINARY_API_KEY    ?? "";
const API_SECRET = process.env.CLOUDINARY_API_SECRET ?? "";

/** POST /api/upload — sube un archivo a Cloudinary */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return NextResponse.json({ error: "Cloudinary no configurado" }, { status: 500 });
  }

  const formData     = await req.formData();
  const file         = formData.get("file")         as File   | null;
  const ticketNumber = formData.get("ticketNumber") as string | null;

  if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder    = ticketNumber ? `solicitudes-im/ticket-${ticketNumber}` : "solicitudes-im";

  // Parámetros firmados ordenados alfabéticamente (requerido por Cloudinary)
  const str     = `access_mode=public&folder=${folder}&timestamp=${timestamp}${API_SECRET}`;
  const msgBuf  = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest("SHA-1", msgBuf);
  const signature = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const cd = new FormData();
  cd.append("file",        file);
  cd.append("api_key",     API_KEY);
  cd.append("timestamp",   timestamp);
  cd.append("signature",   signature);
  cd.append("folder",      folder);
  cd.append("access_mode", "public");

  // Usar "raw" para documentos/PDFs (sirve el archivo original, no lo convierte a imagen)
  // Usar "image" solo para imágenes
  const isImage    = file.type.startsWith("image/");
  const uploadType = isImage ? "image" : "raw";

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${uploadType}/upload`,
    { method: "POST", body: cd }
  );

  const data = await res.json() as { secure_url?: string; error?: { message: string } };

  if (!res.ok || !data.secure_url) {
    console.error("[upload] Cloudinary error:", data.error?.message);
    return NextResponse.json({ error: data.error?.message ?? "Error al subir" }, { status: 500 });
  }

  console.log(`[upload] ${file.name} → ${folder} (${uploadType})`);
  return NextResponse.json({ url: data.secure_url, name: file.name, fileType: file.type });
}
