import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import { Ticket } from "@/models/Ticket";
import { getJsonModel } from "@/lib/gemini";
import { User } from "@/models/User";

const SYSTEM_PROMPT = `Eres un analista senior de Inteligencia de Mercados. Tu tarea es analizar un ticket y generar una recomendación accionable sobre cómo resolverlo.

Responde en este formato JSON:

{
  "approach": "Resumen de 2-3 líneas del enfoque recomendado",
  "steps": ["Paso 1 detallado", "Paso 2 detallado", "..."],
  "tools": ["Herramienta o fuente de datos 1", "Herramienta o fuente de datos 2", "..."],
  "estimatedEffort": "baja|media|alta",
  "keyInsight": "Una observación clave o consideración importante",
  "suggestedPriority": "baja|media|alta|critica"
}

Considera:
- Si necesita datos, sugiere fuentes específicas (MongoDB, APIs, CSV, etc.)
- Si es analítico, sugiere metodología y visualizaciones
- Si es estratégico, sugiere framework de análisis
- Si es soporte, prioriza la solución práctica inmediata
- Mantén los pasos accionables y específicos, no genéricos
- El esfuerzo estimado debe reflejar la complejidad real`;

/** POST /api/tickets/[id]/ai-suggest — generate AI suggestion for a ticket */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  await dbConnect();

  const ticket = await Ticket.findById(id)
    .populate("createdBy", "name email role")
    .populate("assignedTo", "name email role")
    .lean();

  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  function isRateLimit(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes("quota") || msg.includes("429") || msg.includes("rate") || msg.includes("retry");
  }

  async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 10000): Promise<T> {
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (err) {
        if (i < retries && isRateLimit(err)) {
          console.log(`[ai-suggest] Rate limit — reintentando en ${delayMs / 1000}s`);
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        throw err;
      }
    }
    throw new Error("Max retries exceeded");
  }

  try {
    const model = getJsonModel("gemini-2.0-flash");

    const ticketContext = [
      `## Ticket #${ticket.ticketNumber}`,
      `Título: ${ticket.title}`,
      `Categoría: ${ticket.category}`,
      `Prioridad actual: ${ticket.priority}`,
      `Estado: ${ticket.status}`,
      ``,
      `### Descripción`,
      ticket.description,
    ].join("\n");

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        { role: "model", parts: [{ text: "Entendido. Dame el ticket para analizarlo." }] },
      ],
    });

    const result = await withRetry(() => chat.sendMessage(ticketContext));

    const suggestion = JSON.parse(result.response.text()) as {
      approach: string;
      steps: string[];
      tools: string[];
      estimatedEffort: string;
      keyInsight: string;
      suggestedPriority: string;
    };

    // Guardar sugerencia en el ticket
    const suggestionText = JSON.stringify(suggestion, null, 2);
    await Ticket.findByIdAndUpdate(id, {
      aiSuggestion: suggestionText,
      aiSuggestionAt: new Date(),
      aiSuggestionBy: "Gemini 2.0 Flash",
    });

    return NextResponse.json({ suggestion });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("AI suggest error:", msg);
    return NextResponse.json({ error: `Error generando sugerencia: ${msg.slice(0, 200)}` }, { status: 500 });
  }
}
