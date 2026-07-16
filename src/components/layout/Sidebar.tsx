"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard, Ticket, LogOut, ChevronRight,
  UserCog, Users, Settings, BarChart3, X,
} from "lucide-react";
import { useSidebar } from "./LayoutClient";

const ANALISTA_NAV = [
  { href: "/",        label: "Mis Solicitudes", icon: LayoutDashboard },
  { href: "/tickets", label: "Tickets",          icon: Ticket },
];

const ADMIN_SECTIONS = [
  {
    label: "Principal",
    items: [
      { href: "/",        label: "Dashboard",        icon: LayoutDashboard },
      { href: "/tickets", label: "Todos los tickets", icon: Ticket },
    ],
  },
  {
    label: "Gestión",
    items: [
      { href: "/usuarios",      label: "Usuarios", icon: UserCog },
      { href: "/participantes", label: "Equipo",   icon: Users },
    ],
  },
  {
    label: "Analítica",
    items: [
      { href: "/reportes",      label: "Reportes",       icon: BarChart3 },
      { href: "/configuracion", label: "Configuración",  icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname          = usePathname();
  const { data: session } = useSession();
  const { close }         = useSidebar();
  const role              = (session?.user as { role?: string } | undefined)?.role ?? "analista";
  const userName          = session?.user?.name ?? "";

  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

  function NavLink({ href, label, Icon }: { href: string; label: string; Icon: React.ElementType }) {
    const active = isActive(href);
    return (
      <Link
        href={href}
        onClick={close}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
          active
            ? "bg-red-50 text-red-700 font-semibold"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100"
        }`}
      >
        <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
        <span>{label}</span>
        {active && <ChevronRight size={14} className="ml-auto text-red-400" />}
      </Link>
    );
  }

  return (
    <aside className="flex flex-col bg-white border-r border-gray-200 w-[240px] h-full">
      {/* Logo + cerrar mobile */}
      <div className="flex items-center gap-3 px-5 h-14 border-b border-gray-100">
        <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold text-xs shadow-sm flex-shrink-0">
          IM
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 leading-tight">Solicitudes IM</p>
          <p className="text-xs text-gray-400">El Espectador</p>
        </div>
        <button
          onClick={close}
          className="lg:hidden p-1.5 text-gray-400 hover:text-gray-700 rounded-lg transition"
        >
          <X size={16} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
        {role === "admin" ? (
          ADMIN_SECTIONS.map((section) => (
            <div key={section.label} className="mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-1.5">
                {section.label}
              </p>
              {section.items.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} Icon={item.icon} />
              ))}
            </div>
          ))
        ) : (
          ANALISTA_NAV.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} Icon={item.icon} />
          ))
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
          {userName ? userName.charAt(0).toUpperCase() : "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-900 truncate">{userName || "Usuario"}</p>
          <p className="text-xs text-gray-400">{role === "admin" ? "Administrador" : "Analista"}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
          title="Cerrar sesión"
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
