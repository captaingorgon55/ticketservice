import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { google } from "googleapis";
import { Readable } from "stream";

export const maxDuration = 60;

const FOLDER_ID        = process.env.GOOGLE_DRIVE_FOLDER_ID ?? "";
const SERVICE_ACCOUNT  = process.env.GOOGLE_SERVICE_ACCOUNT ?? "";

/** POST /api/upload — sube un archivo a Google Drive */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  if (!FOLDER_ID || !SERVICE_ACCOUNT) {
    return NextResponse.json({ error: "Google Drive no configurado (faltan GOOGLE_DRIVE_FOLDER_ID o GOOGLE_SERVICE_ACCOUNT)" }, { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });

  try {
    const credentials = JSON.parse(SERVICE_ACCOUNT) as object;
    const driveAuth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    const drive = google.drive({ version: "v3", auth: driveAuth });

    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = Readable.from(buffer);

    const uploaded = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [FOLDER_ID],
      },
      media: {
        mimeType: file.type || "application/octet-stream",
        body: stream,
      },
      fields: "id,webViewLink",
    });

    const fileId = uploaded.data.id!;

    // Hacer el archivo accesible con el link (solo lectura)
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    const url = uploaded.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`;

    console.log(`[upload] Archivo subido a Drive: ${file.name} → ${url}`);
    return NextResponse.json({ url, name: file.name, type: file.type });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[upload] Error Google Drive:", msg);
    return NextResponse.json({ error: `Error al subir: ${msg.slice(0, 200)}` }, { status: 500 });
  }
}
