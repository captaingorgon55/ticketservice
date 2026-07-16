import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const maxDuration = 60;

const DATABRICKS_HOST  = (process.env.DATABRICKS_HOST  ?? "").replace(/\/$/, "");
const DATABRICKS_TOKEN = process.env.DATABRICKS_TOKEN  ?? "";
const DBFS_BASE        = "solicitudes-im";

/** POST /api/upload — sube un archivo a Databricks DBFS */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  if (!DATABRICKS_HOST || !DATABRICKS_TOKEN) {
    return NextResponse.json({ error: "Databricks no configurado (faltan DATABRICKS_HOST o DATABRICKS_TOKEN)" }, { status: 500 });
  }

  const formData     = await req.formData();
  const file         = formData.get("file")         as File   | null;
  const ticketNumber = formData.get("ticketNumber") as string | null;

  if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });

  const folder   = ticketNumber ? `${DBFS_BASE}/ticket-${ticketNumber}` : DBFS_BASE;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const dbfsPath = `/${folder}/${Date.now()}-${safeName}`;

  const buffer = await file.arrayBuffer();

  // Databricks Files API — PUT /api/2.0/fs/files/{path}
  const res = await fetch(
    `${DATABRICKS_HOST}/api/2.0/fs/files${dbfsPath}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${DATABRICKS_TOKEN}`,
        "Content-Type": "application/octet-stream",
      },
      body: buffer,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("[upload] Databricks error:", err.slice(0, 200));
    return NextResponse.json({ error: `Error al subir a Databricks: ${err.slice(0, 150)}` }, { status: 500 });
  }

  // La URL es interna — se sirve a través de nuestro proxy /api/files
  const url = `/api/files${dbfsPath}?name=${encodeURIComponent(file.name)}`;
  console.log(`[upload] ${file.name} → dbfs:${dbfsPath}`);
  return NextResponse.json({ url, name: file.name, type: file.type });
}
