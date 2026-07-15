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

/** GET /api/admin/users — list all users */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  await dbConnect();
  const users = await User.find({}, "-password").sort({ createdAt: 1 }).lean();
  return NextResponse.json({ users });
}

/** POST /api/admin/users — create a user */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();
  const { name, email, password, role, area } = body as {
    name?: string; email?: string; password?: string; role?: string; area?: string;
  };

  if (!name || !email || !password) {
    return NextResponse.json({ error: "name, email y password son obligatorios" }, { status: 400 });
  }
  if (!["admin", "analista"].includes(role ?? "analista")) {
    return NextResponse.json({ error: "role inválido" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  }

  await dbConnect();
  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) return NextResponse.json({ error: "Ya existe un usuario con ese correo" }, { status: 409 });

  const hash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hash,
    role: role ?? "analista",
    area: area?.trim() ?? "Inteligencia de Mercados",
  });

  return NextResponse.json(
    { user: { _id: user._id, name: user.name, email: user.email, role: user.role, area: user.area, isActive: user.isActive } },
    { status: 201 }
  );
}
