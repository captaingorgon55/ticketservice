import mongoose, { Schema, model, models } from "mongoose";

export type UserRole = "admin" | "analista";

export interface IUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  area: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role:     { type: String, enum: ["admin", "analista"], default: "analista" },
    isActive: { type: Boolean, default: true },
    area:     { type: String, default: "Inteligencia de Mercados", trim: true },
  },
  { timestamps: true }
);

export const User = models.User ?? model<IUser>("User", UserSchema);
