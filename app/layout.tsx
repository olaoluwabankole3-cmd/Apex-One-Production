import type { Metadata } from "next";
import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { OrganizationProvider } from "@/components/layout/OrganizationContext";
import { RoleProvider } from "@/components/layout/RoleContext";
import { ValueEngineProvider } from "@/components/value-engine/ValueEngineContext";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
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
  title: "CANARY POINT OS by Apex Sync Intelligence",
  description: "The Intelligent Operating System for Modern Enterprises.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const earlySuppressionScript = `
    (function() {
      function isNoise(s) {
        if (!s) return false;
        var str = typeof s === 'string' ? s : (s.message || JSON.stringify(s) || '');
        var l = str.toLowerCase();
        return l.indexOf('sender-wallet') !== -1 ||
               l.indexOf('sender_getproviderstate') !== -1 ||
               l.indexOf('sender: failed to get initial state') !== -1 ||
               l.indexOf('no account exist') !== -1 ||
               l.indexOf('sender-wallet-providerresult') !== -1 ||
               l.indexOf('chrome-extension://') !== -1 ||
               l.indexOf('moz-extension://') !== -1;
      }
      window.addEventListener('unhandledrejection', function(e) {
        if (isNoise(e.reason)) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }, true);
      window.addEventListener('error', function(e) {
        if (isNoise(e.message) || isNoise(e.error) || isNoise(e.filename)) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }, true);
    })();
  `;

  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: earlySuppressionScript }} />
      </head>
      <body className="font-body bg-matte text-ivory antialiased">
        <ClientErrorBoundary>
          <OrganizationProvider>
            <RoleProvider>
              <ValueEngineProvider>
                <div className="flex min-h-screen">
                  <Sidebar />
                  <div className="flex-1 flex flex-col min-w-0">
                    <Topbar />
                    <main className="flex-1 px-4 sm:px-6 pb-12 pt-6 lg:px-10 ml-0 -mt-[8px]">{children}</main>
                  </div>
                </div>
              </ValueEngineProvider>
            </RoleProvider>
          </OrganizationProvider>
        </ClientErrorBoundary>
      </body>
    </html>
  );
}
