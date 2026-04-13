import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthCallback from "@/components/auth/AuthCallback";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "JJL Elite",
  description: "Programa Elite de Jiu Jitsu Latino — Entrenamiento High Ticket 1 a 1",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "JJL Elite",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-full bg-jjl-dark text-white font-sans antialiased">
        <AuthCallback />
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    // Check for updates every 60s
                    setInterval(function() { reg.update(); }, 60000);
                    // When new SW is found, it auto-activates (skipWaiting)
                    // then reload to use the new version
                    var refreshing = false;
                    navigator.serviceWorker.addEventListener('controllerchange', function() {
                      if (!refreshing) {
                        refreshing = true;
                        window.location.reload();
                      }
                    });
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
