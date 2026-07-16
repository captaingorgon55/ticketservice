"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus, UserCheck, UserX, Shield, Edit2 } from "lucide-react";

interface UserData {
  _id: string; name: string; email: string;
  role: "admin" | "analista"; area: string; isActive: boolean;
}

async function apiFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await res.json();
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "Error");
  return body;
}

function UserRow({ user, onEdit, onToggle }: {
  user: UserData;
  onEdit: (u: UserData) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 ${!user.isActive ? "opacity-50" : ""}`}>
      <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
        {user.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{user.name}</p>
        <p className="text-xs text-gray-400">{user.email}</p>
      </div>
      <span className="text-xs text-gray-400 hidden sm:block">{user.area}</span>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        user.role === "admin" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
      }`}>
        {user.role === "admin" ? <Shield size={10} /> : <UserCheck size={10} />}
        {user.role === "admin" ? "Admin" : "Analista"}
      </span>
      <div className="flex items-center gap-2">
        <button onClick={() => onEdit(user)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition">
          <Edit2 size={14} />
        </button>
        <button
          onClick={() => onToggle(user._id, !user.isActive)}
          className={`p-1.5 rounded transition ${user.isActive ? "text-gray-400 hover:text-red-600 hover:bg-red-50" : "text-gray-400 hover:text-green-600 hover:bg-green-50"}`}
          title={user.isActive ? "Desactivar" : "Activar"}
        >
          {user.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
        </button>
      </div>
    </div>
  );
}

function UserForm({ user, onClose, onSave }: {
  user: UserData | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName]       = useState(user?.name ?? "");
  const [email, setEmail]     = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole]       = useState<"admin" | "analista">(user?.role ?? "analista");
  const [area, setArea]       = useState(user?.area ?? "Inteligencia de Mercados");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (user) {
        await apiFetch(`/api/admin/users/${user._id}`, {
          method: "PATCH",
          body: JSON.stringify({ name, role, area, ...(password ? { password } : {}) }),
        });
      } else {
        if (!password) { setError("La contraseña es obligatoria"); setLoading(false); return; }
        await apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify({ name, email, password, role, area }) });
      }
      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">{user ? "Editar usuario" : "Nuevo usuario"}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          {!user && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{user ? "Nueva contraseña (opcional)" : "Contraseña *"}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8}
              placeholder={user ? "Dejar vacío para no cambiar" : "Mínimo 8 caracteres"}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "analista")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="analista">Analista</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Área</label>
              <input value={area} onChange={(e) => setArea(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {user ? "Guardar cambios" : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ParticipantesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<UserData | null | undefined>(undefined);

  const { data, isLoading } = useQuery<{ users: UserData[] }>({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch("/api/admin/users"),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const users   = data?.users ?? [];
  const activos = users.filter((u) => u.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Equipo</h1>
          <p className="text-sm text-gray-400 mt-0.5">{activos} usuarios activos</p>
        </div>
        <button
          onClick={() => setEditing(null)}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
        >
          <UserPlus size={15} /> Nuevo usuario
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
        ) : users.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-12">Sin usuarios</p>
        ) : (
          users.map((u) => (
            <UserRow
              key={u._id}
              user={u}
              onEdit={(user) => setEditing(user)}
              onToggle={(id, active) => toggleMut.mutate({ id, isActive: active })}
            />
          ))
        )}
      </div>

      {editing !== undefined && (
        <UserForm
          user={editing}
          onClose={() => setEditing(undefined)}
          onSave={() => qc.invalidateQueries({ queryKey: ["admin-users"] })}
        />
      )}
    </div>
  );
}
