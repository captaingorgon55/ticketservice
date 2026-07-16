"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { Mail, Bell, Shield, Info } from "lucide-react";

export default function ConfiguracionPage() {
  const { data: session } = useSession();
  const user = session?.user as { name?: string; email?: string; role?: string; area?: string } | undefined;
  const [saved, setSaved] = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-400 mt-0.5">Información del sistema y tu cuenta</p>
      </div>

      {/* Perfil */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={15} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">Mi cuenta</h2>
        </div>
        <div className="space-y-3">
          {[
            { label: "Nombre", value: user?.name },
            { label: "Correo", value: user?.email },
            { label: "Rol", value: user?.role === "admin" ? "Administrador" : "Analista" },
            { label: "Área", value: user?.area ?? "Inteligencia de Mercados" },
          ].map((f) => (
            <div key={f.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-500">{f.label}</span>
              <span className="text-sm font-medium text-gray-800">{f.value ?? "—"}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Para cambiar tu contraseña o información de perfil, pide al administrador que lo haga desde <strong>Equipo</strong>.
        </p>
      </div>

      {/* Notificaciones */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={15} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">Notificaciones de correo</h2>
        </div>
        <form onSubmit={handleSave} className="space-y-3">
          {[
            { id: "notify-assign", label: "Cuando me asignan un ticket", defaultChecked: true },
            { id: "notify-comment", label: "Cuando comentan en mis tickets", defaultChecked: true },
            { id: "notify-status", label: "Cuando cambia el estado de mis tickets", defaultChecked: true },
            { id: "notify-participant", label: "Cuando me agregan como participante", defaultChecked: true },
          ].map((opt) => (
            <label key={opt.id} className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked={opt.defaultChecked}
                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
          <div className="pt-2">
            <button type="submit"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition">
              {saved ? "✓ Guardado" : "Guardar preferencias"}
            </button>
          </div>
        </form>
      </div>

      {/* Info del sistema */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Info size={15} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">Sistema</h2>
        </div>
        <div className="space-y-2">
          {[
            { label: "Aplicación", value: "Solicitudes IM" },
            { label: "Versión", value: "1.0.0" },
            { label: "Equipo", value: "Inteligencia de Mercados — El Espectador" },
            { label: "Email de soporte", value: "inteligenciademercadosee@gmail.com" },
          ].map((f) => (
            <div key={f.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-500">{f.label}</span>
              <span className="text-sm text-gray-700">{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Email config info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Mail size={15} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">Configuración de correo</h2>
        </div>
        <p className="text-sm text-gray-500">
          Los correos se envían a través de <strong>Brevo</strong>. Para cambiar el remitente o los destinatarios del equipo,
          actualiza las variables <code className="bg-gray-100 px-1 rounded text-xs">EMAIL_FROM</code> y{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">NOTIFY_EMAILS</code> en el panel de Render.
        </p>
      </div>
    </div>
  );
}
