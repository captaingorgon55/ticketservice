import { Schema, model, models } from "mongoose";

const FileAttachmentSchema = new Schema(
  {
    ticketId:    { type: String, required: true },
    name:        { type: String, required: true },
    contentType: { type: String, required: true },
    size:        { type: Number },
    data:        { type: Buffer, required: true },
  },
  { timestamps: true }
);

export const FileAttachment = models.FileAttachment ?? model("FileAttachment", FileAttachmentSchema);
