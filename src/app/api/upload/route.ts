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

  const ticketNumber = formData.get("ticketNumber") as string | null;
  const ticketTitle  = formData.get("ticketTitle")  as string | null;

  try {
    const credentials = JSON.parse(SERVICE_ACCOUNT) as object;
    const driveAuth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    const drive = google.drive({ version: "v3", auth: driveAuth });

    // ── Crear o encontrar subcarpeta del ticket ──────────
    let targetFolderId = FOLDER_ID;

    if (ticketNumber) {
      const folderName = ticketTitle
        ? `#${ticketNumber} - ${ticketTitle.slice(0, 60)}`
        : `Ticket #${ticketNumber}`;

      // Buscar si ya existe
      const existing = await drive.files.list({
        q: `name='${folderName.replace(/'/g, "\\'")}' and '${FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id)",
        pageSize: 1,
      });

      if (existing.data.files && existing.data.files.length > 0) {
        targetFolderId = existing.data.files[0].id!;
      } else {
        const newFolder = await drive.files.create({
          requestBody: {
            name: folderName,
            mimeType: "application/vnd.google-apps.folder",
            parents: [FOLDER_ID],
          },
          fields: "id",
        });
        targetFolderId = newFolder.data.id!;
        // Hacer la carpeta accesible con link
        await drive.permissions.create({
          fileId: targetFolderId,
          requestBody: { role: "reader", type: "anyone" },
        });
      }
    }

    // ── Subir el archivo a la carpeta del ticket ─────────
    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = Readable.from(buffer);

    const uploaded = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [targetFolderId],
      },
      media: {
        mimeType: file.type || "application/octet-stream",
        body: stream,
      },
      fields: "id,webViewLink",
    });

    const fileId = uploaded.data.id!;

    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    const url = uploaded.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`;
    console.log(`[upload] ${file.name} → carpeta #${ticketNumber ?? "general"} en Drive`);
    return NextResponse.json({ url, name: file.name, type: file.type });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[upload] Error Google Drive:", msg);
    return NextResponse.json({ error: `Error al subir: ${msg.slice(0, 200)}` }, { status: 500 });
  }
}
