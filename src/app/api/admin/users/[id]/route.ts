import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import { User } from "@/models/User";

async function requireAdmin() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "admin") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  return null;
}

/** PATCH /api/admin/users/[id] — update user */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const { name, role, isActive, password, area } = body as {
    name?: string; role?: string; isActive?: boolean; password?: string; area?: string;
  };

  await dbConnect();
  const user = await User.findById(id);
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  if (name     !== undefined) user.name     = name;
  if (isActive !== undefined) user.isActive = isActive;
  if (area     !== undefined) user.area     = area;

  if (role !== undefined) {
    if (!["admin", "analista"].includes(role)) {
      return NextResponse.json({ error: "role inválido" }, { status: 400 });
    }
    user.role = role as "admin" | "analista";
  }

  if (password !== undefined) {
    if (password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }
    user.password = await bcrypt.hash(password, 12);
  }

  await user.save();
  return NextResponse.json({
    user: { _id: user._id, name: user.name, email: user.email, role: user.role, area: user.area, isActive: user.isActive },
  });
}

/** DELETE /api/admin/users/[id] — soft-delete user */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  await dbConnect();
  const user = await User.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
