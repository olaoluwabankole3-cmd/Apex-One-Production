import type { Metadata } from "next";
import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { OrganizationProvider } from "@/components/layout/OrganizationContext";
import { RoleProvider } from "@/components/layout/RoleContext";
import { ValueEngineProvider } from "@/components/value-engine/ValueEngineContext";
import { AuthProvider } from "@/components/auth/AuthContext";
import AppShell from "@/components/layout/AppShell";
import { ClientErrorBoundary } from "@/components/layout/ClientErrorBoundary";

const syne = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "APEX ONE — Executive Intelligence Operating System",
  description:
    "A secure enterprise intelligence and execution operating system by Apex Sync Intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
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
