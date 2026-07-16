"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp, CheckCircle2, Clock, AlertCircle, Users } from "lucide-react";
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from "@/lib/constants";

interface Stats {
  total: number; open: number; closed: number; resolved: number; unassigned: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
}

interface WorkloadEntry {
  _id: string | null; name: string; area: string;
  total: number; abierto: number; en_progreso: number; en_revision: number;
  resuelto: number; cerrado: number; active: number;
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right font-medium">{value}</span>
    </div>
  );
}

async function apiFetch(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error");
  return res.json();
}

export default function ReportesPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["ticket-stats"],
    queryFn: () => apiFetch("/api/tickets/stats"),
    refetchInterval: 60_000,
  });

  const { data: workloadData, isLoading: wLoading } = useQuery<{ workload: WorkloadEntry[] }>({
    queryKey: ["ticket-workload"],
    queryFn: () => apiFetch("/api/tickets/workload"),
    refetchInterval: 60_000,
  });

  if (statsLoading || wLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-gray-300" /></div>;
  }

  const workload = workloadData?.workload ?? [];
  const maxActive = Math.max(...workload.map((w) => w.active), 1);
  const maxTotal  = Math.max(...workload.map((w) => w.total), 1);
  const catMax    = stats ? Math.max(...Object.values(stats.byCategory), 1) : 1;
  const priMax    = stats ? Math.max(...Object.values(stats.byPriority), 1) : 1;
  const resolutionRate = stats && stats.total > 0
    ? Math.round(((stats.resolved + stats.closed) / stats.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-400 mt-0.5">Analítica de solicitudes del equipo</p>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total solicitudes", value: stats.total, icon: <TrendingUp size={18} />, color: "#6b7280" },
            { label: "Activas", value: stats.open, icon: <Clock size={18} />, color: "#3b82f6" },
            { label: "Resueltas", value: stats.resolved + stats.closed, icon: <CheckCircle2 size={18} />, color: "#10b981" },
            { label: "Tasa resolución", value: `${resolutionRate}%`, icon: <AlertCircle size={18} />, color: "#f59e0b" },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">{k.label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${k.color}15`, color: k.color }}>
                  {k.icon}
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Carga por analista */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-5">
            <Users size={15} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Rendimiento por analista</h2>
          </div>
          {workload.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin datos</p>
          ) : (
            <div className="space-y-4">
              {workload.map((w) => {
                const rate = w.total > 0 ? Math.round(((w.resuelto + w.cerrado) / w.total) * 100) : 0;
                return (
                  <div key={String(w._id ?? "none")}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <span className="text-sm font-medium text-gray-800">{w.name}</span>
                        {w.area && <span className="text-xs text-gray-400 ml-2">{w.area}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="text-blue-500 font-medium">{w.active} activos</span>
                        <span className="text-green-500 font-medium">{rate}% resuelto</span>
                        <span className="text-gray-400">{w.total} total</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Carga activa</p>
                        <Bar value={w.active} max={maxActive} color="#3b82f6" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Total asignados</p>
                        <Bar value={w.total} max={maxTotal} color="#10b981" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Por categoría y prioridad */}
        <div className="space-y-4">
          {stats && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Por categoría</h2>
                <div className="space-y-3">
                  {TICKET_CATEGORIES.map((cat) => (
                    <div key={cat.value}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{cat.icon} {cat.label}</span>
                      </div>
                      <Bar value={stats.byCategory[cat.value] ?? 0} max={catMax} color={cat.color} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Por prioridad</h2>
                <div className="space-y-3">
                  {TICKET_PRIORITIES.map((pri) => (
                    <div key={pri.value}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: pri.color }} className="font-medium">{pri.label}</span>
                      </div>
                      <Bar value={stats.byPriority[pri.value] ?? 0} max={priMax} color={pri.color} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
