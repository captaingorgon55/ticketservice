import { LayoutClient } from "@/components/layout/LayoutClient";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <LayoutClient>{children}</LayoutClient>
    </div>
  );
}
