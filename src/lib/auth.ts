import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import dbConnect from "./dbConnect";
import { User } from "../models/User";
import type { UserRole } from "../models/User";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Credenciales",
      credentials: {
        email:    { label: "Correo",     type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email    = credentials?.email    as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        await dbConnect();
        const user = await User.findOne({ email: email.toLowerCase(), isActive: true });
        if (!user) return null;

        const { compare } = await import("bcryptjs");
        const valid = await compare(password, user.password);
        if (!valid) return null;

        return {
          id:    String(user._id),
          name:  String(user.name),
          email: String(user.email),
          role:  String(user.role) as UserRole,
          area:  String(user.area ?? "Inteligencia de Mercados"),
        };
      },
    }),
  ],
  trustHost: true,
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id   = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role  = (user as { role?: UserRole }).role ?? "analista";
        token.area  = (user as { area?: string }).area ?? "Inteligencia de Mercados";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id    = token.id as string;
        session.user.name                       = token.name as string;
        session.user.email                      = token.email as string;
        (session.user as { role?: UserRole }).role = token.role as UserRole;
        (session.user as { area?: string }).area   = token.area as string;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
});
