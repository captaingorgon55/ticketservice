import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import { User } from "@/models/User";

/** GET /api/tickets/assignable-users — list active users (any authenticated user can access) */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  await dbConnect();
  const users = await User.find({ isActive: true }, "name email role area")
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({ users });
}
