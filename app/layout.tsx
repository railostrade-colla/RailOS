import type { Metadata } from "next"
import { Toaster } from "react-hot-toast"
import { RealtimeProvider } from "@/lib/realtime/RealtimeProvider"
import { DealRequestModal } from "@/components/deals/DealRequestModal"
import { ContractInviteModal } from "@/components/contracts/ContractInviteModal"
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt"
import { ThemeProvider } from "@/lib/theme/ThemeProvider"
import { PreferencesProvider } from "@/lib/preferences/usePreferences"
import "./globals.css"

// Phase 14.13 M2 — no-FOUC theme bootstrap. Runs BEFORE first paint
// so a light-mode user never sees a dark flash. Mirrors
// ThemeProvider's resolve() logic in vanilla JS. Kept tiny + inline.
const THEME_BOOTSTRAP = `
(function(){try{
  var d=document.documentElement;
  var c=localStorage.getItem('railos:theme');
  var sysLight=window.matchMedia('(prefers-color-scheme: light)').matches;
  var light=(c==='light')||(c==='system'&&sysLight);
  if(light)d.setAttribute('data-theme','light');
  /* Phase 14.13 PART A — appearance prefs, pre-paint (no FOUC) */
  var p={};try{p=JSON.parse(localStorage.getItem('railos:prefs')||'{}')||{}}catch(e){}
  d.setAttribute('data-font-size',(p.fontSize==='small'||p.fontSize==='large')?p.fontSize:'medium');
  d.setAttribute('data-density',p.density==='compact'?'compact':'comfortable');
  d.setAttribute('data-animations',p.animations===false?'off':'on');
}catch(e){}})();`

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
      <head>
        {/* Phase 14.13 M2 — no-FOUC theme bootstrap (runs pre-paint) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      {/* Phase 14.13 M2 — body bg/text now come from CSS vars
          (globals.css html,body rule) so they flip with the theme.
          The old hardcoded `bg-black text-white` would have pinned
          the shell dark even in light mode. */}
      <body className="antialiased">
        <ThemeProvider>
        <PreferencesProvider>
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
        </PreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
