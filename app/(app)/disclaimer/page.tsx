"use client"

/**
 * /disclaimer — Phase 14.11 A7.
 *
 * The legal clarification page. RailOS is an organisation +
 * proof-of-ownership platform with escrow ON SHARES (not money).
 * Money never touches the platform — payment happens off-platform
 * (Zain Cash / Asia Hawala / bank transfer). This page states that
 * explicitly so users and regulators understand the model.
 *
 * Mirrors the accordion pattern + Iraqi-law citations used by
 * /terms and /privacy for visual + structural consistency.
 */

import { useState } from "react"
import { ChevronDown, ShieldCheck } from "lucide-react"
import { AppLayout } from "@/components/layout/AppLayout"
import { PageHeader } from "@/components/layout/PageHeader"
import { cn } from "@/lib/utils/cn"

const SECTIONS = [
  {
    title: "ماهية RailOS",
    icon: "🏛️",
    content:
      "RailOS منصّة تنظيم وعرض الفرص الاستثمارية وإثبات الملكية الرقمي. نحن نوفّر: تنظيم فرص الاستثمار، عرض المشاريع، توثيق الصفقات بين المستخدمين، وضمان الحصص عبر نظام Escrow على الحصص (وليس على الأموال).",
    legal:
      "استناداً إلى حرية التعاقد وتنظيم العلاقات بين الأطراف في القانون المدني العراقي رقم (40) لسنة 1951.",
  },
  {
    title: "ما لسنا",
    icon: "🚫",
    content:
      "RailOS ليست بنكاً ولا منصّة مالية. لا نتعامل بالأموال إطلاقاً، ولا نحتفظ بأرصدة نقدية للمستخدمين، ولا نضمن إتمام التحويلات المالية بين الأطراف. أيّ تحويل مالي يتمّ خارج المنصّة وعلى مسؤولية الطرفين.",
    legal:
      "لا تقوم المنصّة بأيّ نشاط مصرفي أو مالي يستوجب ترخيصاً من البنك المركزي العراقي، لانتفاء التعامل النقدي داخلها.",
  },
  {
    title: "كيف يعمل النظام",
    icon: "⚙️",
    content:
      "1) المنصّة تعرض الفرص. 2) البائع ينشر إعلاناً (listing). 3) المشتري يقبل. 4) تُجمَّد الحصص في Escrow. 5) الدفع يتمّ خارج المنصّة (Zain Cash، آسيا حوالة، تحويل بنكي، أو أيّ وسيلة يتّفق عليها الطرفان). 6) رفع إيصال الدفع للتوثيق. 7) تأكيد الاستلام من البائع. 8) نقل الحصص للمشتري.",
    legal:
      "العقد بين الطرفين هو الأساس؛ المنصّة تُوثّق مراحله وتضمن الحصص محلّ التعاقد فقط.",
  },
  {
    title: "مسؤولية المستخدمين",
    icon: "👤",
    content:
      "يتحمّل المستخدمون: التحقّق من بيانات الطرف الآخر، إتمام التحويل المالي بأنفسهم، حفظ إثبات التحويل، والإبلاغ الفوري عن أيّ مشكلة عبر نظام النزاعات أو البريد الرسمي.",
    legal:
      "استناداً إلى أحكام المسؤولية العقدية في القانون المدني العراقي — كلّ طرف مسؤول عن التزاماته.",
  },
  {
    title: "مسؤوليتنا",
    icon: "🛡️",
    content:
      "نلتزم بـ: توفير منصّة آمنة، حماية الحصص عبر Escrow، توثيق كلّ عملية، إثبات الملكية الرقمي، وحلّ النزاعات بشفافية. للتواصل: railostrade@gmail.com",
    legal:
      "نطاق مسؤوليتنا محصور بما نوفّره من خدمة تنظيم وتوثيق، دون ضمان للنتائج المالية للصفقات.",
  },
] as const

export default function DisclaimerPage() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <AppLayout>
      <div className="px-3 lg:px-8 py-6 max-w-3xl mx-auto">
        <PageHeader
          title="إخلاء المسؤولية"
          subtitle="طبيعة المنصّة والإطار القانوني"
        />

        {/* Hero clarification */}
        <div className="bg-gradient-to-br from-green-400/[0.08] to-blue-400/[0.05] border border-green-400/20 rounded-2xl p-5 mb-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-400/15 border border-green-400/30 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-green-300" strokeWidth={2} />
            </div>
            <div>
              <div className="text-sm font-bold text-white mb-1">
                RailOS — منصّة تنظيم وعرض، لا منصّة مالية
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                لا نتعامل بالأموال. ننظّم الفرص ونوثّق الصفقات ونحمي
                الحصص عبر Escrow. الدفع يتمّ خارج المنصّة بين الطرفين
                مباشرةً، وعلى مسؤوليتهما.
              </p>
            </div>
          </div>
        </div>

        {/* Accordion sections */}
        <div className="space-y-2">
          {SECTIONS.map((s, i) => {
            const isOpen = open === i
            return (
              <div
                key={s.title}
                className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.06] transition-colors text-right"
                  aria-expanded={isOpen}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="text-lg">{s.icon}</span>
                    <span className="text-sm font-bold text-white">
                      {s.title}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-neutral-400 transition-transform flex-shrink-0",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-white/[0.06] space-y-3">
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      {s.content}
                    </p>
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                      <div className="text-[10px] text-neutral-500 font-bold mb-1">
                        الأساس القانوني
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        {s.legal}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Contact */}
        <div className="mt-5 bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 text-center">
          <p className="text-xs text-neutral-400 leading-relaxed">
            لأيّ استفسار قانوني أو الإبلاغ عن مشكلة:
          </p>
          <a
            href="mailto:railostrade@gmail.com"
            className="text-sm font-bold text-green-300 hover:text-green-200 transition-colors"
            dir="ltr"
          >
            railostrade@gmail.com
          </a>
        </div>
      </div>
    </AppLayout>
  )
}
