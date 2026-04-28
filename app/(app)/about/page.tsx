"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { Target, Sparkles, Lock, Globe, Handshake, Rocket, Mail, Phone, Headphones, ChevronRight } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { GridBackground } from "@/components/layout/GridBackground"
import { PageHeader } from "@/components/layout/PageHeader"
import { Footer } from "@/components/layout/Footer"
import { APP_NAME, APP_NAME_EN } from "@/lib/utils/version"

const VALUES = [
  { Icon: Lock, title: "الأمان", desc: "حماية أموالك وبياناتك بأعلى معايير الأمان", color: "text-blue-400", bg: "bg-blue-400/[0.06]", border: "border-blue-400/20" },
  { Icon: Globe, title: "الشفافية", desc: "معلومات واضحة وصادقة لكل عملية وصفقة", color: "text-green-400", bg: "bg-green-400/[0.06]", border: "border-green-400/20" },
  { Icon: Handshake, title: "الثقة", desc: "بناء علاقات استثمارية قائمة على الثقة المتبادلة", color: "text-purple-400", bg: "bg-purple-400/[0.06]", border: "border-purple-400/20" },
  { Icon: Rocket, title: "الابتكار", desc: "تقنية حديثة لتجربة استثمارية لا مثيل لها", color: "text-yellow-400", bg: "bg-yellow-400/[0.06]", border: "border-yellow-400/20" },
]

const STATS = [
  { value: "+500", label: "مستثمر مسجل" },
  { value: "+50", label: "مشروع نشط" },
  { value: "+2م", label: "حجم التداول IQD" },
  { value: "98%", label: "رضا المستخدمين" },
]

const TEAM = [
  { name: "أحمد محمد", role: "المدير التنفيذي" },
  { name: "علي حسن", role: "مدير التطوير" },
  { name: "سارة محمود", role: "مديرة العمليات" },
]

export default function AboutPage() {
  const router = useRouter()

  return (
    <AppLayout>
      <div className="relative">
        <GridBackground showCircles={false} />

        <div className="relative z-10 px-4 lg:px-8 py-8 lg:py-12 max-w-4xl mx-auto">

          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white mb-6 transition-colors"
          >
            <ChevronRight className="w-4 h-4" strokeWidth={2} />
            <span>رجوع</span>
          </button>

          {/* Hero - logo + name (footer style) */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/[0.1] flex items-center justify-center bg-black flex-shrink-0">
                <Image src="/logo.png" alt={APP_NAME} width={40} height={40} className="w-full h-full object-contain" />
              </div>
              <div className="text-right">
                <div className="text-base font-bold text-white">{APP_NAME}</div>
                <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">{APP_NAME_EN}</div>
              </div>
            </div>
            <div className="text-lg font-bold text-white max-w-md leading-relaxed">
              نبني مستقبل الاستثمار في العراق
            </div>
          </div>

          {/* Mission + Vision */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
            <div className="bg-blue-400/[0.06] border border-blue-400/20 rounded-2xl p-5">
              <div className="w-10 h-10 rounded-lg bg-blue-400/[0.1] border border-blue-400/20 flex items-center justify-center mb-3">
                <Target className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
              </div>
              <div className="text-sm font-bold text-blue-400 mb-2">رسالتنا</div>
              <div className="text-xs text-neutral-300 leading-relaxed">
                رايلوس منصة تقنية متخصصة في تنظيم وإدارة الفرص الاستثمارية، تربط المستثمرين بالشركات
                وأصحاب المشاريع الواعدة في العراق والمنطقة.
              </div>
            </div>
            <div className="bg-green-400/[0.06] border border-green-400/20 rounded-2xl p-5">
              <div className="w-10 h-10 rounded-lg bg-green-400/[0.1] border border-green-400/20 flex items-center justify-center mb-3">
                <Sparkles className="w-5 h-5 text-green-400" strokeWidth={1.5} />
              </div>
              <div className="text-sm font-bold text-green-400 mb-2">رؤيتنا</div>
              <div className="text-xs text-neutral-300 leading-relaxed">
                نؤمن أن الوصول للفرص الاستثمارية يجب أن يكون متاحاً للجميع — شفافاً، آمناً، وسهلاً.
              </div>
            </div>
          </div>

          {/* Values */}
          <div className="mb-8">
            <div className="text-base font-bold text-white mb-4">قيمنا الأساسية</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {VALUES.map((v, i) => {
                const Icon = v.Icon
                return (
                  <div key={i} className={`${v.bg} ${v.border} border rounded-2xl p-4`}>
                    <div className={`w-10 h-10 rounded-lg ${v.bg} ${v.border} border flex items-center justify-center mb-3`}>
                      <Icon className={`w-5 h-5 ${v.color}`} strokeWidth={1.5} />
                    </div>
                    <div className="text-sm font-bold text-white mb-1">{v.title}</div>
                    <div className="text-[11px] text-neutral-400 leading-relaxed">{v.desc}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-8">
            <div className="text-base font-bold text-white text-center mb-5">أرقامنا</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {STATS.map((s, i) => (
                <div key={i} className="text-center">
                  <div className="text-2xl lg:text-3xl font-bold text-white font-mono mb-1">{s.value}</div>
                  <div className="text-[11px] text-neutral-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Team */}
          <div className="mb-8">
            <div className="text-base font-bold text-white mb-4">فريق العمل</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {TEAM.map((m, i) => (
                <div key={i} className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 border-2 border-white/[0.1] flex items-center justify-center mx-auto mb-3 text-2xl font-bold text-white">
                    {m.name.charAt(0)}
                  </div>
                  <div className="text-sm font-bold text-white mb-0.5">{m.name}</div>
                  <div className="text-[11px] text-neutral-500">{m.role}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 mb-6">
            <div className="text-base font-bold text-white mb-4">تواصل معنا</div>
            <div className="space-y-3">
              <a href="mailto:railostrade@gmail.com" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="w-9 h-9 rounded-lg bg-blue-400/[0.1] border border-blue-400/20 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500">البريد الإلكتروني</div>
                  <div className="text-sm font-bold text-white" dir="ltr">railostrade@gmail.com</div>
                </div>
              </a>
              <a href="tel:+9647721726518" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="w-9 h-9 rounded-lg bg-green-400/[0.1] border border-green-400/20 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 text-green-400" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-[10px] text-neutral-500">الهاتف</div>
                  <div className="text-sm font-bold text-white" dir="ltr">07721726518</div>
                </div>
              </a>
              <button onClick={() => router.push("/support")} className="w-full mt-3 bg-neutral-100 text-black py-2.5 rounded-xl text-sm font-bold hover:bg-neutral-200 transition-colors">
                فتح تذكرة دعم
              </button>
            </div>
          </div>

          <Footer compact />

        </div>
      </div>
    </AppLayout>
  )
}
