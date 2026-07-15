import mongoose, { Schema, model, models } from "mongoose";

export type CommentType = "comment" | "status_change" | "assignment" | "resolution" | "system";

export interface ITicketComment {
  _id: mongoose.Types.ObjectId;
  ticket:   mongoose.Types.ObjectId;
  author:   mongoose.Types.ObjectId;
  content:  string;
  type:     CommentType;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const TicketCommentSchema = new Schema<ITicketComment>(
  {
    ticket:   { type: Schema.Types.ObjectId, ref: "Ticket", required: true },
    author:   { type: Schema.Types.ObjectId, ref: "User",   required: true },
    content:  { type: String, required: true, maxlength: 3000 },
    type: {
      type: String,
      enum: ["comment", "status_change", "assignment", "resolution", "system"],
      default: "comment",
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

TicketCommentSchema.index({ ticket: 1, createdAt: 1 });

export const TicketComment =
  models.TicketComment ?? model<ITicketComment>("TicketComment", TicketCommentSchema);
