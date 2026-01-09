import { TenantProvider } from "@/components/providers/TenantProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { TenantSidebar } from "@/components/dashboard/TenantSidebar";

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <TenantProvider>
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
          <TenantSidebar />
          <main className="flex-1 p-6 lg:ml-64 overflow-auto">
            {children}
          </main>
        </div>
      </TenantProvider>
    </ThemeProvider>
  );
}
