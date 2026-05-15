import type { Metadata } from "next"
import { Toaster } from "react-hot-toast"
import { RealtimeProvider } from "@/lib/realtime/RealtimeProvider"
import { DealRequestModal } from "@/components/deals/DealRequestModal"
import { ContractInviteModal } from "@/components/contracts/ContractInviteModal"
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

// Phase 14.12 P3 — resolve the Supabase origin once at module load so
// we can emit preconnect / dns-prefetch resource hints. Every page
// makes its first data call to Supabase; warming the TCP+TLS handshake
// in parallel with HTML parse shaves ~50-150ms off that first request
// (more on mobile / high-latency links — relevant for Iraq). Guarded
// so a missing env at build time can't crash the layout.
function supabaseOrigin(): string | null {
  try {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL
    return u ? new URL(u).origin : null
  } catch {
    return null
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const sbOrigin = supabaseOrigin()
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="bg-black text-white antialiased">
        {/* Phase 14.12 P3 — Next 16 / React 19 hoist these <link>s into
            <head>. preconnect opens the connection eagerly; the
            crossOrigin variant covers the authenticated fetch + the
            realtime websocket which both run cross-origin. */}
        {sbOrigin && (
          <>
            <link rel="preconnect" href={sbOrigin} />
            <link rel="preconnect" href={sbOrigin} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={sbOrigin} />
          </>
        )}
        <RealtimeProvider>
          {children}
          <DealRequestModal />
          {/* Phase 13.58 — global popup for pending contract invites. */}
          <ContractInviteModal />
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
