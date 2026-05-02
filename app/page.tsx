"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogIn, UserPlus } from "lucide-react"
import { showError } from "@/lib/utils/toast"
import { createClient } from "@/lib/supabase/client"
import { APP_NAME, APP_DESCRIPTION } from "@/lib/utils/version"
import { cn } from "@/lib/utils/cn"

export default function HomePage() {
  const router = useRouter()
  const [loadingGoogle, setLoadingGoogle] = useState(false)

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined" ? window.location.origin + "/auth/callback" : undefined,
        },
      })
      if (error) showError("فشل تسجيل الدخول بـ Google")
    } catch {
      showError("فشل تسجيل الدخول بـ Google")
    } finally {
      setLoadingGoogle(false)
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center px-6 py-10 overflow-hidden">
<div className="relative z-10 w-full max-w-sm flex flex-col items-center text-center animate-[fadeIn_0.8s_ease-out]">

        {/* Logo */}
        <div className="w-32 h-32 lg:w-40 lg:h-40 rounded-3xl overflow-hidden border border-white/[0.1] flex items-center justify-center bg-black shadow-2xl mb-6 animate-[bounceIn_1s_ease-out]">
          <Image
            src="/logo.png"
            alt={APP_NAME}
            width={160}
            height={160}
            priority
            className="w-full h-full object-contain"
          />
        </div>

        {/* Brand name (Arabic) */}
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight bg-gradient-to-b from-white to-neutral-500 bg-clip-text text-transparent mb-2">
          {APP_NAME}
        </h1>

        {/* Tagline */}
        <p className="text-sm text-neutral-400 mb-12">
          {APP_DESCRIPTION}
        </p>

        {/* Primary actions */}
        <div className="w-full space-y-3 mb-6">
          <button
            onClick={() => router.push("/login")}
            className="w-full bg-neutral-100 text-black hover:bg-neutral-200 py-3.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" strokeWidth={2.5} />
            تسجيل الدخول
          </button>
          <button
            onClick={() => router.push("/register")}
            className="w-full bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] text-white py-3.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4" strokeWidth={2.5} />
            إنشاء حساب
          </button>
        </div>

        {/* Divider */}
        <div className="w-full flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-white/[0.08]" />
          <span className="text-[11px] text-neutral-500">أو</span>
          <div className="flex-1 h-px bg-white/[0.08]" />
        </div>

        {/* Google */}
        <button
          onClick={handleGoogleLogin}
          disabled={loadingGoogle}
          className={cn(
            "w-full bg-white text-gray-900 border border-gray-300 py-3.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2.5",
            loadingGoogle ? "opacity-60 cursor-wait" : "hover:bg-gray-100",
          )}
        >
          {loadingGoogle ? (
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          متابعة باستخدام Google
        </button>

        {/* Footer text */}
        <p className="text-[10px] text-neutral-600 text-center mt-8 leading-relaxed">
          بالمتابعة، أنت توافق على{" "}
          <Link href="/terms" className="text-blue-400 hover:text-blue-300">شروط الاستخدام</Link>
          {" "}و{" "}
          <Link href="/privacy" className="text-blue-400 hover:text-blue-300">سياسة الخصوصية</Link>
        </p>
      </div>

      {/* Inline animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounceIn {
          0%   { opacity: 0; transform: scale(0.7); }
          70%  { opacity: 1; transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>
    </main>
  )
}
