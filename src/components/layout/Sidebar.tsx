"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard, Ticket, Users, LogOut, ChevronRight,
  BarChart3, UserCog,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/",             label: "Dashboard",     icon: LayoutDashboard },
  { href: "/tickets",     label: "Tickets",        icon: Ticket },
  { href: "/usuarios",    label: "Usuarios",       icon: UserCog, minRole: "admin" as const },
];

export function Sidebar() {
  const pathname          = usePathname();
  const { data: session } = useSession();
  const role              = (session?.user as { role?: string } | undefined)?.role ?? "analista";
  const userName          = session?.user?.name ?? "";

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className="flex flex-col border-r border-gray-200 bg-white"
      style={{ width: 240, height: "100vh", position: "fixed", left: 0, top: 0, zIndex: 40 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
          HD
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 leading-tight">Solicitudes IM</p>
          <p className="text-xs text-gray-400">Inteligencia de Mercados</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          if (item.minRole && item.minRole !== role) return null;
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-red-50 text-red-700 font-semibold"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
              <span>{item.label}</span>
              {active && <ChevronRight size={14} className="ml-auto text-red-400" />}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">
          {userName ? userName.charAt(0).toUpperCase() : "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{userName || "Usuario"}</p>
          <p className="text-xs text-gray-400">{role === "admin" ? "Administrador" : "Analista"}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Cerrar sesión"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
