"use client";

import { useSession } from "next-auth/react";

export function Header() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "analista";

  return (
    <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6 sticky top-0 z-30">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Mesa de Ayuda</h1>
        <p className="text-xs text-gray-400">Inteligencia de Mercados</p>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-200">
          {role === "admin" ? "Admin" : "Analista"}
        </span>
        <span className="text-sm font-medium text-gray-600">
          {session?.user?.name || "Usuario"}
        </span>
      </div>
    </header>
  );
}
