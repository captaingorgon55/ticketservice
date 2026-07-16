"use client";

import { useState, createContext, useContext } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

const SidebarCtx = createContext({ open: false, toggle: () => {}, close: () => {} });
export const useSidebar = () => useContext(SidebarCtx);

export function LayoutClient({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((o) => !o);
  const close  = () => setOpen(false);

  return (
    <SidebarCtx.Provider value={{ open, toggle, close }}>
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={close}
        />
      )}

      {/* Sidebar — drawer en mobile, fija en desktop */}
      <div
        className={`fixed top-0 left-0 h-full z-40 transform transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0`}
      >
        <Sidebar />
      </div>

      {/* Contenido principal */}
      <div className="lg:ml-[240px] min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </SidebarCtx.Provider>
  );
}
