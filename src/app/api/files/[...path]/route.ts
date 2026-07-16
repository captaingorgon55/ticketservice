import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const DATABRICKS_HOST  = (process.env.DATABRICKS_HOST  ?? "").replace(/\/$/, "");
const DATABRICKS_TOKEN = process.env.DATABRICKS_TOKEN  ?? "";

/** GET /api/files/[...path] — sirve un archivo desde Databricks DBFS */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  if (!session) return new NextResponse("No autenticado", { status: 401 });

  const { path } = await params;
  const dbfsPath = "/" + path.join("/");
  const fileName = req.nextUrl.searchParams.get("name") ?? path[path.length - 1];

  const res = await fetch(
    `${DATABRICKS_HOST}/api/2.0/fs/files${dbfsPath}`,
    {
      headers: { Authorization: `Bearer ${DATABRICKS_TOKEN}` },
    }
  );

  if (!res.ok) {
    return new NextResponse("Archivo no encontrado", { status: 404 });
  }

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const body        = await res.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
