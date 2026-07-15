"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Power, KeyRound, Check, X, Shield, User } from "lucide-react";

type UserRow = {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "analista";
  isActive: boolean;
  area: string;
};

type FormMode = "create" | "edit" | "password" | null;

const EMPTY_FORM = { name: "", email: "", password: "", role: "analista" as "admin" | "analista", area: "Inteligencia de Mercados" };

async function apiFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export default function UsuariosPage() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<FormMode>(null);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [passForm, setPassForm] = useState({ password: "", confirm: "" });
  const [formError, setFormError] = useState("");

  const { data, isLoading } = useQuery<{ users: UserRow[] }>({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch("/api/admin/users"),
  });

  const createMut = useMutation({
    mutationFn: (body: typeof EMPTY_FORM) => apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); closeModal(); },
    onError: (e: Error) => setFormError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<UserRow> }) =>
      apiFetch(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); closeModal(); },
    onError: (e: Error) => setFormError(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const passMut = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      apiFetch(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify({ password }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); closeModal(); },
    onError: (e: Error) => setFormError(e.message),
  });

  function openCreate() { setForm(EMPTY_FORM); setFormError(""); setEditing(null); setMode("create"); }
  function openEdit(u: UserRow) { setForm({ name: u.name, email: u.email, password: "", role: u.role, area: u.area }); setFormError(""); setEditing(u); setMode("edit"); }
  function openPassword(u: UserRow) { setPassForm({ password: "", confirm: "" }); setFormError(""); setEditing(u); setMode("password"); }
  function closeModal() { setMode(null); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (mode === "create") { createMut.mutate(form); }
    else if (mode === "edit" && editing) { updateMut.mutate({ id: editing._id, body: { name: form.name, role: form.role, area: form.area } }); }
    else if (mode === "password" && editing) {
      if (passForm.password !== passForm.confirm) { setFormError("Las contraseñas no coinciden"); return; }
      passMut.mutate({ id: editing._id, password: passForm.password });
    }
  }

  const users = data?.users ?? [];
  const isPending = createMut.isPending || updateMut.isPending || passMut.isPending;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestión de Usuarios</h1>
          <p className="text-sm text-gray-400 mt-0.5">Administra los usuarios del Help Desk</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
        >
          <Plus size={16} />
          Nuevo Usuario
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando usuarios…</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {["Nombre", "Correo", "Rol", "Área", "Estado", "Acciones"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u._id} className={`${u.isActive ? "" : "opacity-50"} hover:bg-gray-50 transition`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      u.role === "admin" ? "bg-red-50 text-red-600" : "bg-violet-50 text-violet-600"
                    }`}>
                      {u.role === "admin" ? <Shield size={11} /> : <User size={11} />}
                      {u.role === "admin" ? "Admin" : "Analista"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.area}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs ${u.isActive ? "text-green-600" : "text-gray-400"}`}>
                      {u.isActive ? <Check size={12} /> : <X size={12} />}
                      {u.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition" title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => openPassword(u)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition" title="Cambiar contraseña">
                        <KeyRound size={14} />
                      </button>
                      <button
                        onClick={() => toggleMut.mutate({ id: u._id, isActive: !u.isActive })}
                        className={`p-1.5 rounded transition ${
                          u.isActive ? "text-gray-400 hover:text-red-600 hover:bg-red-50" : "text-green-500 hover:text-green-700 hover:bg-green-50"
                        }`}
                        title={u.isActive ? "Desactivar" : "Activar"}
                      >
                        <Power size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {mode && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 fade-in">
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              {mode === "create" ? "Nuevo Usuario" : mode === "edit" ? "Editar Usuario" : "Cambiar Contraseña"}
            </h2>
            {mode === "edit" && editing && (
              <p className="text-sm text-gray-400 mb-4">{editing.email}</p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {(mode === "create" || mode === "edit") && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                    <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  {mode === "create" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Correo</label>
                      <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                    </div>
                  )}
                  {mode === "create" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                      <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required />
                    </div>
                  )}
                  {mode === "edit" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Área</label>
                      <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "analista" })}>
                      <option value="analista">Analista</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </>
              )}

              {mode === "password" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
                    <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" type="password" value={passForm.password} onChange={(e) => setPassForm({ ...passForm, password: e.target.value })} minLength={8} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
                    <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" type="password" value={passForm.confirm} onChange={(e) => setPassForm({ ...passForm, confirm: e.target.value })} minLength={8} required />
                  </div>
                </>
              )}

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition">Cancelar</button>
                <button type="submit" disabled={isPending} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
                  {isPending ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
