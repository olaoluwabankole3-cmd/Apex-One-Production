import type { Metadata } from "next";
import "./globals.css";
import { OrganizationProvider } from "@/components/layout/OrganizationContext";
import { RoleProvider } from "@/components/layout/RoleContext";
import { ValueEngineProvider } from "@/components/value-engine/ValueEngineContext";
import { AuthProvider } from "@/components/auth/AuthContext";
import AppShell from "@/components/layout/AppShell";
import { ClientErrorBoundary } from "@/components/layout/ClientErrorBoundary";

export const metadata: Metadata = {
  title: "CORTEX by QORVEX — Financial Intelligence Workspace",
  description:
    "A secure institutional workspace for evidence, context, authorized analysis and accountable action. Financial source connectors remain in development.",
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
