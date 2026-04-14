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
                  var hadController = !!navigator.serviceWorker.controller;
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    setInterval(function() { reg.update(); }, 60000);
                    document.addEventListener('visibilitychange', function() {
                      if (document.visibilityState === 'visible') reg.update();
                    });
                    var refreshing = false;
                    navigator.serviceWorker.addEventListener('controllerchange', function() {
                      if (!hadController || refreshing) return;
                      refreshing = true;
                      window.location.reload();
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
