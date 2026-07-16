import mongoose, { Schema, model, models } from "mongoose";

// Schema explícito para evitar conflicto con la palabra reservada "type" de Mongoose
const AttachmentSchema = new Schema(
  { name: { type: String }, url: { type: String }, fileType: { type: String } },
  { _id: false }
);

export type TicketCategory =
  | "analisis" | "insights" | "estrategia" | "datos"
  | "reporte"  | "soporte"  | "otro";

export type TicketPriority = "baja" | "media" | "alta" | "critica";
export type TicketStatus  = "abierto" | "en_progreso" | "en_revision" | "resuelto" | "cerrado";
export type TicketSource  = "interna" | "solicitud" | "solicitud_publicacion";

export interface ITicket {
  _id: mongoose.Types.ObjectId;
  ticketNumber: number;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  source: TicketSource;
  createdBy: mongoose.Types.ObjectId;
  assignedTo:   mongoose.Types.ObjectId | null;
  participants: mongoose.Types.ObjectId[];
  tags: string[];
  dueDate: Date | null;
  aiSuggestion: string | null;
  aiSuggestionAt: Date | null;
  aiSuggestionBy: string | null;
  resolvedAt: Date | null;
  resolution: string | null;
  isActive: boolean;
  // ── Campos específicos para solicitudes de publicación ──
  journalistName: string | null;
  objective: string | null;
  strategicTiming: string | null;
  baseText: string | null;
  mustInclude: string | null;
  supportingMaterials: string | null;
  attachments: { name: string; url: string; fileType: string }[];
  createdAt: Date;
  updatedAt: Date;
}

const TicketSchema = new Schema<ITicket>(
  {
    ticketNumber: { type: Number, required: true },
    title:        { type: String, required: true, trim: true, maxlength: 200 },
    description:  { type: String, required: true, maxlength: 5000 },
    category: {
      type: String,
      enum: ["analisis", "insights", "estrategia", "datos", "reporte", "soporte", "otro"],
      required: true,
    },
    priority: {
      type: String,
      enum: ["baja", "media", "alta", "critica"],
      default: "media",
    },
    status: {
      type: String,
      enum: ["abierto", "en_progreso", "en_revision", "resuelto", "cerrado"],
      default: "abierto",
    },
    source: {
      type: String,
      enum: ["interna", "solicitud", "solicitud_publicacion"],
      default: "interna",
    },
    createdBy:   { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo:   { type: Schema.Types.ObjectId, ref: "User", default: null },
  participants: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    tags:        { type: [String], default: [] },
    dueDate:     { type: Date, default: null },
    aiSuggestion:    { type: String, default: null },
    aiSuggestionAt:  { type: Date, default: null },
    aiSuggestionBy:  { type: String, default: null },
    resolvedAt:      { type: Date, default: null },
    resolution:      { type: String, default: null, maxlength: 3000 },
    isActive:        { type: Boolean, default: true },
    // ── Campos de solicitud de publicación ──
    journalistName:       { type: String, default: null, maxlength: 200 },
    objective:            { type: String, default: null, maxlength: 2000 },
    strategicTiming:      { type: String, default: null, maxlength: 500 },
    baseText:             { type: String, default: null, maxlength: 10000 },
    mustInclude:          { type: String, default: null, maxlength: 3000 },
    supportingMaterials:  { type: String, default: null, maxlength: 5000 },
  attachments: { type: [AttachmentSchema], default: [] },
  },
  { timestamps: true }
);

TicketSchema.index({ status: 1, priority: -1, createdAt: -1 });
TicketSchema.index({ assignedTo: 1, status: 1 });
TicketSchema.index({ createdBy: 1 });
TicketSchema.index({ ticketNumber: 1 }, { unique: true });

export const Ticket = models.Ticket ?? model<ITicket>("Ticket", TicketSchema);

// ── Counter for auto-incrementing ticketNumber ──

interface ICounter {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter = models.Counter ?? model<ICounter>("Counter", CounterSchema);

export async function getNextTicketNumber(): Promise<number> {
  const counter = await Counter.findByIdAndUpdate(
    "ticketNumber",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}
