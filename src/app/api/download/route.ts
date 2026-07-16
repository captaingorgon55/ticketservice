import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const maxDuration = 30;

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME ?? "";
const API_KEY    = process.env.CLOUDINARY_API_KEY    ?? "";
const API_SECRET = process.env.CLOUDINARY_API_SECRET ?? "";

/**
 * GET /api/download?u=<cloudinary_url>&n=<filename>
 * Proxy autenticado: el servidor obtiene el archivo de Cloudinary y lo sirve al usuario.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return new NextResponse("No autenticado", { status: 401 });

  const rawUrl  = req.nextUrl.searchParams.get("u") ?? "";
  const name    = req.nextUrl.searchParams.get("n") ?? "archivo";

  if (!rawUrl) return new NextResponse("URL requerida", { status: 400 });

  // Extraer public_id de la URL de Cloudinary
  // Formato: https://res.cloudinary.com/{cloud}/{type}/upload/v{version}/{public_id}
  const match = rawUrl.match(/\/(?:image|raw|video)\/(?:upload|authenticated)\/(?:v\d+\/)?(.+)$/);
  if (!match) return new NextResponse("URL inválida", { status: 400 });

  // Raw files: la extensión ES parte del public_id en Cloudinary
  // Image files: la extensión NO es parte del public_id
  const resourceType = rawUrl.includes("/raw/") ? "raw" : rawUrl.includes("/video/") ? "video" : "image";
  const publicId = resourceType === "raw"
    ? match[1]                          // mantener extensión para raw
    : match[1].replace(/\.[^.]+$/, ""); // quitar extensión para imágenes
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // Firma para el endpoint de download
  const str     = `public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`;
  const msgBuf  = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest("SHA-1", msgBuf);
  const signature = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // URL de descarga autenticada de Cloudinary
  const downloadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/download` +
    `?public_id=${encodeURIComponent(publicId)}&api_key=${API_KEY}&timestamp=${timestamp}&signature=${signature}`;

  // Redirigir a la URL firmada de descarga
  return NextResponse.redirect(downloadUrl);
}
