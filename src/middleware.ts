import { NextResponse } from "next/server";

const SESSION_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "__Host-next-auth.session-token",
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "__Host-authjs.session-token",
];

export default function middleware(req: Request) {
  const cookie = req.headers.get("cookie") ?? "";

  const hasSession = SESSION_COOKIE_NAMES.some((name) => cookie.includes(name));

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|api/auth|api/health|.*\\.[\\w]+$).*)",
  ],
};
