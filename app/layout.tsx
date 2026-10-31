import type { Metadata } from "next";
import "./globals.css";
import { OrganizationProvider } from "@/components/layout/OrganizationContext";
import { RoleProvider } from "@/components/layout/RoleContext";
import { ValueEngineProvider } from "@/components/value-engine/ValueEngineContext";
import { AuthProvider } from "@/components/auth/AuthContext";
import AppShell from "@/components/layout/AppShell";
import { ClientErrorBoundary } from "@/components/layout/ClientErrorBoundary";

export const metadata: Metadata = {
  title: "CORTEX — Executive Intelligence Operating System",
  description:
    "A secure enterprise intelligence and execution operating system by QORVEX.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-matte font-body text-ivory antialiased">
        <ClientErrorBoundary>
          <AuthProvider>
            <OrganizationProvider>
              <RoleProvider>
                <ValueEngineProvider>
                  <AppShell>{children}</AppShell>
                </ValueEngineProvider>
              </RoleProvider>
            </OrganizationProvider>
          </AuthProvider>
        </ClientErrorBoundary>
      </body>
    </html>
  );
}
