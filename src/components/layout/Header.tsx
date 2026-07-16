"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function Header() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "analista";
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (/^\d+$/.test(q)) {
      router.push(`/?ticketNumber=${q}`);
    } else {
      router.push(`/?q=${encodeURIComponent(q)}`);
    }
    setQuery("");
  }

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center gap-4 px-6 sticky top-0 z-30">
      <form onSubmit={handleSearch} className="flex-1 max-w-sm">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por # o texto..."
            className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition"
          />
        </div>
      </form>
      <div className="flex items-center gap-3 ml-auto">
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
