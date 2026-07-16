"use client";

import { useRouter } from "next/navigation";

export default function ParticipantesPage() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
        <span className="text-3xl">👥</span>
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Equipos</h1>
      <p className="text-sm text-gray-400 mb-4">Gestiona equipos desde cada ticket individualmente</p>
      <button onClick={() => router.push("/")} className="text-sm text-red-600 hover:underline">
        Ir al Dashboard
      </button>
    </div>
  );
}
