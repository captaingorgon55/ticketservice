// Este endpoint ya no es necesario — los archivos se sirven desde /api/files/[id]
// Se mantiene por compatibilidad con adjuntos antiguos de Cloudinary

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return new NextResponse("No autenticado", { status: 401 });

  const rawUrl = req.nextUrl.searchParams.get("u") ?? "";
  const name   = req.nextUrl.searchParams.get("n") ?? "archivo";

  if (!rawUrl) return new NextResponse("URL requerida", { status: 400 });

  // Si ya es una URL interna /api/files/..., redirigir usando APP_URL
  if (rawUrl.startsWith("/api/files/")) {
    const base = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    return NextResponse.redirect(new URL(rawUrl, base));
  }

  // Para URLs externas de Cloudinary (adjuntos antiguos), intentar fetch directo
  try {
    const res = await fetch(rawUrl);
    if (!res.ok) {
      return new NextResponse(`No se pudo obtener el archivo (${res.status}). Es un archivo antiguo - vuelve a subirlo.`, { status: 502 });
    }
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        "Content-Type":        res.headers.get("content-type") ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(name)}"`,
      },
    });
  } catch {
    return new NextResponse("Error al obtener el archivo", { status: 502 });
  }
}
