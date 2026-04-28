import type { Metadata } from "next"
import { Toaster } from "react-hot-toast"
import { RealtimeProvider } from "@/lib/realtime/RealtimeProvider"
import { DealRequestModal } from "@/components/deals/DealRequestModal"
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt"
import "./globals.css"

export const metadata: Metadata = {
  title: "Railos - منصة التداول الاستثماري",
  description: "منصة عراقية لعرض وتنظيم الفرص الاستثمارية",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "رايلوس",
  },
}

export const viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="bg-black text-white antialiased">
        <RealtimeProvider>
          {children}
          <DealRequestModal />
          <PWAInstallPrompt />
        </RealtimeProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#0a0a0a',
              color: '#fff',
              border: '0.5px solid #1a1a1a',
              borderRadius: '10px',
              fontSize: '13px',
            },
          }}
        />
      </body>
    </html>
  )
}
