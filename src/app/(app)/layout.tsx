import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div style={{ marginLeft: 240 }}>
        <Header />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
