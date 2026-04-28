import toast from "react-hot-toast"

/**
 * Toast helpers بتصميم Railos
 *
 * الاستخدام:
 * ```tsx
 * import { showSuccess, showError } from "@/lib/utils/toast"
 *
 * showSuccess("تم الحفظ بنجاح")
 * showError("حدث خطأ")
 * ```
 */

const baseStyle = {
  background: '#0a0a0a',
  color: '#fff',
  border: '0.5px solid',
  borderRadius: '10px',
  fontSize: '13px',
  padding: '12px 16px',
  fontFamily: 'Tajawal, sans-serif',
}

export function showSuccess(message: string) {
  return toast.success(message, {
    style: { ...baseStyle, borderColor: 'rgba(74, 222, 128, 0.4)' },
    iconTheme: { primary: '#4ADE80', secondary: '#0a0a0a' },
    duration: 3000,
  })
}

export function showError(message: string) {
  return toast.error(message, {
    style: { ...baseStyle, borderColor: 'rgba(248, 113, 113, 0.4)' },
    iconTheme: { primary: '#F87171', secondary: '#0a0a0a' },
    duration: 4000,
  })
}

export function showWarning(message: string) {
  return toast(message, {
    style: { ...baseStyle, borderColor: 'rgba(251, 191, 36, 0.4)' },
    icon: '⚠️',
    duration: 3500,
  })
}

export function showInfo(message: string) {
  return toast(message, {
    style: { ...baseStyle, borderColor: 'rgba(96, 165, 250, 0.4)' },
    icon: 'ℹ️',
    duration: 3000,
  })
}

export function showLoading(message: string) {
  return toast.loading(message, {
    style: { ...baseStyle, borderColor: 'rgba(255, 255, 255, 0.2)' },
  })
}

export function dismissToast(toastId: string) {
  toast.dismiss(toastId)
}

export { toast }
