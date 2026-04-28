export const mockAdminStats = {
  // المالية
  totalUsers: 1247,
  activeUsers: 892,
  totalTrades: 387,
  pendingTrades: 12,
  cancelledTrades: 24,
  activeListings: 45,
  dailyVolume: 12500000,

  // المشاريع
  activeProjects: 8,
  pendingProjects: 3,
  closedProjects: 2,

  // الحصص
  totalShares: 88000,
  tradedShares: 32400,
  frozenShares: 1250,

  // النشاط
  openAuctions: 5,
  closedAuctions: 28,
  activeContracts: 16,
  pendingContracts: 4,
  openDisputes: 2,
  publishedNews: 14,

  // KYC
  kycPending: 7,
  kycVerified: 685,
  kycRejected: 18,

  // مؤشر الصحة
  marketHealth: 87,
}

export const mockPendingTrades = [
  { id: "tr1", project_name: "مزرعة الواحة", shares: 50, price: 95000, total: 4750000, created_at: "2026-04-25 14:30", buyer: "أحمد محمد", seller: "علي حسن" },
  { id: "tr2", project_name: "برج بغداد", shares: 20, price: 245000, total: 4900000, created_at: "2026-04-25 13:15", buyer: "محمد أحمد", seller: "سارة محمود" },
  { id: "tr3", project_name: "مجمع الكرخ", shares: 100, price: 170000, total: 17000000, created_at: "2026-04-25 12:00", buyer: "زين العبيدي", seller: "نور الدين" },
  { id: "tr4", project_name: "صفا الذهبي", shares: 30, price: 115000, total: 3450000, created_at: "2026-04-25 11:30", buyer: "ياسمين كريم", seller: "كريم علي" },
  { id: "tr5", project_name: "مزرعة الواحة", shares: 15, price: 96000, total: 1440000, created_at: "2026-04-25 10:45", buyer: "هدى صبري", seller: "أحمد محمد" },
]

export const mockKYCPending = [
  { id: "u1", name: "كريم علي", phone: "+964 770 1111111", joined: "2026-04-22" },
  { id: "u2", name: "هدى صبري", phone: "+964 770 2222222", joined: "2026-04-23" },
  { id: "u3", name: "ضيف الله سعيد", phone: "+964 770 3333333", joined: "2026-04-24" },
  { id: "u4", name: "ليلى ناصر", phone: "+964 770 4444444", joined: "2026-04-24" },
]

export const mockAlerts = [
  { id: "a1", type: "critical", title: "نزاع جديد على صفقة #1247", body: "المشتري يدعي عدم استلام الحصص", time: "منذ 5 دقائق", action: "/admin?tab=disputes" },
  { id: "a2", type: "warning", title: "7 طلبات KYC معلقة", body: "بحاجة لمراجعة عاجلة", time: "منذ ساعة", action: "/admin?tab=users" },
  { id: "a3", type: "warning", title: "12 صفقة معلقة", body: "تنتظر موافقة الإدارة", time: "منذ ساعتين", action: "/admin?tab=trades" },
  { id: "a4", type: "info", title: "حجم تداول مرتفع اليوم", body: "زيادة 32% عن المتوسط", time: "اليوم 10:30", action: "/admin?tab=monitor" },
  { id: "a5", type: "info", title: "مشروع جديد بانتظار المراجعة", body: "صناعة أبناء العراق", time: "اليوم 09:15", action: "/admin?tab=projects" },
]

export const mockDecisionLog = [
  { id: "l1", admin: "Admin@1", action: "approved_kyc", target: "علي حسن", details: "تم توثيق الحساب", timestamp: "2026-04-25 14:25" },
  { id: "l2", admin: "Admin@1", action: "confirmed_trade", target: "صفقة #1245", details: "حصص مزرعة الواحة - 50 حصة", timestamp: "2026-04-25 13:45" },
  { id: "l3", admin: "Admin@2", action: "rejected_kyc", target: "ضيف مجهول", details: "صور غير واضحة", timestamp: "2026-04-25 12:30" },
  { id: "l4", admin: "Admin@1", action: "topped_fee_units", target: "محمد أحمد", details: "+50,000 وحدة رسم", timestamp: "2026-04-25 11:15" },
  { id: "l5", admin: "Admin@2", action: "approved_project", target: "مجمع الكرخ", details: "تمت الموافقة بعد المراجعة", timestamp: "2026-04-24 16:00" },
  { id: "l6", admin: "Admin@1", action: "resolved_dispute", target: "نزاع #234", details: "صالح المشتري - استرداد كامل", timestamp: "2026-04-24 14:30" },
  { id: "l7", admin: "Admin@1", action: "blocked_user", target: "Spam Account", details: "نشاط احتيالي مكتشف", timestamp: "2026-04-23 18:00" },
  { id: "l8", admin: "Admin@2", action: "published_news", target: "ارتفاع أسعار حصص الواحة", details: "تم نشر في الصفحة الرئيسية", timestamp: "2026-04-23 10:00" },
]

export const actionLabels: Record<string, { label: string; color: "green" | "red" | "blue" | "yellow" | "purple" | "orange" }> = {
  approved_kyc: { label: "✓ توثيق KYC", color: "green" },
  rejected_kyc: { label: "✗ رفض KYC", color: "red" },
  confirmed_trade: { label: "✓ تأكيد صفقة", color: "green" },
  cancelled_trade: { label: "✗ إلغاء صفقة", color: "red" },
  topped_fee_units: { label: "💳 شحن وحدات", color: "blue" },
  approved_project: { label: "✓ قبول مشروع", color: "green" },
  rejected_project: { label: "✗ رفض مشروع", color: "red" },
  resolved_dispute: { label: "⚖ حل نزاع", color: "purple" },
  blocked_user: { label: "🚫 حظر مستخدم", color: "red" },
  unblocked_user: { label: "✓ فك حظر", color: "green" },
  published_news: { label: "📰 نشر خبر", color: "blue" },
}

// ===== Projects =====
export const mockProjectsAdmin = [
  { id: "p1", name: "مزرعة الواحة", sector: "زراعة", entity_type: "project", share_price: 100000, total_shares: 10000, available_shares: 2500, project_value: 1000000000, status: "active", quality: "high", created_at: "2025-06-15" },
  { id: "p2", name: "برج بغداد", sector: "تجارة", entity_type: "project", share_price: 250000, total_shares: 8000, available_shares: 4400, project_value: 2000000000, status: "active", quality: "high", created_at: "2025-08-10" },
  { id: "p3", name: "مجمع الكرخ", sector: "عقارات", entity_type: "project", share_price: 175000, total_shares: 12000, available_shares: 4560, project_value: 2100000000, status: "active", quality: "medium", created_at: "2025-04-20" },
  { id: "p4", name: "صفا الذهبي", sector: "صناعة", entity_type: "project", share_price: 120000, total_shares: 9000, available_shares: 6300, project_value: 1080000000, status: "active", quality: "medium", created_at: "2025-10-05" },
  { id: "c1", name: "شركة الواحة الزراعية", sector: "زراعة", entity_type: "company", share_price: 0, total_shares: 0, available_shares: 0, project_value: 5000000000, status: "active", quality: "high", created_at: "2024-01-15" },
  { id: "c2", name: "بغداد العقارية", sector: "عقارات", entity_type: "company", share_price: 0, total_shares: 0, available_shares: 0, project_value: 12000000000, status: "active", quality: "high", created_at: "2023-05-20" },
  { id: "p5", name: "مشروع جديد - مراجعة", sector: "تقنية", entity_type: "project", share_price: 50000, total_shares: 5000, available_shares: 5000, project_value: 250000000, status: "pending", quality: "medium", created_at: "2026-04-23" },
]

// ===== Listings =====
export const mockListingsAdmin = [
  { id: "l1", project_name: "مزرعة الواحة", user_name: "علي حسن", type: "sell", shares: 50, price: 95000, status: "active", created_at: "2026-04-25" },
  { id: "l2", project_name: "برج بغداد", user_name: "محمد أحمد", type: "sell", shares: 25, price: 245000, status: "active", created_at: "2026-04-25" },
  { id: "l3", project_name: "مجمع الكرخ", user_name: "سارة محمود", type: "buy", shares: 100, price: 170000, status: "active", created_at: "2026-04-24" },
  { id: "l4", project_name: "صفا الذهبي", user_name: "زين العبيدي", type: "sell", shares: 30, price: 118000, status: "completed", created_at: "2026-04-23" },
  { id: "l5", project_name: "مزرعة الواحة", user_name: "نور الدين", type: "buy", shares: 75, price: 96000, status: "active", created_at: "2026-04-22" },
]

// ===== Trades =====
export const mockTradesAdmin = [
  { id: "t1", project_name: "مزرعة الواحة", buyer: "أحمد محمد", seller: "علي حسن", shares: 50, price: 95000, total: 4750000, status: "pending", created_at: "2026-04-25 14:30" },
  { id: "t2", project_name: "برج بغداد", buyer: "محمد أحمد", seller: "سارة محمود", shares: 20, price: 245000, total: 4900000, status: "pending", created_at: "2026-04-25 13:15" },
  { id: "t3", project_name: "مجمع الكرخ", buyer: "زين العبيدي", seller: "نور الدين", shares: 100, price: 170000, total: 17000000, status: "confirmed", created_at: "2026-04-24" },
  { id: "t4", project_name: "صفا الذهبي", buyer: "ياسمين كريم", seller: "كريم علي", shares: 30, price: 115000, total: 3450000, status: "cancelled", created_at: "2026-04-22" },
]

// ===== Auctions =====
export const mockAuctionsAdmin = [
  { id: "au1", project_name: "مزرعة الواحة", shares: 50, opening_price: 80000, current_price: 92000, bids_count: 12, status: "active", ends_at: "2026-04-25 15:30" },
  { id: "au2", project_name: "برج بغداد", shares: 25, opening_price: 200000, current_price: 235000, bids_count: 8, status: "active", ends_at: "2026-04-25 19:00" },
  { id: "au3", project_name: "مجمع الكرخ", shares: 100, opening_price: 140000, current_price: 162000, bids_count: 24, status: "active", ends_at: "2026-04-26 14:00" },
  { id: "au4", project_name: "صفا الذهبي - مغلق", shares: 40, opening_price: 100000, current_price: 124000, bids_count: 15, status: "completed", ends_at: "2026-04-23 18:00" },
]

// ===== Bids =====
export const mockBidsAdmin = [
  { id: "b1", auction_id: "au1", user_name: "علي حسن", amount: 92000, created_at: "2026-04-25 14:25" },
  { id: "b2", auction_id: "au1", user_name: "محمد أحمد", amount: 90000, created_at: "2026-04-25 14:20" },
  { id: "b3", auction_id: "au2", user_name: "سارة محمود", amount: 235000, created_at: "2026-04-25 14:15" },
  { id: "b4", auction_id: "au3", user_name: "زين العبيدي", amount: 162000, created_at: "2026-04-25 14:10" },
]

// ===== Direct Buy Requests =====
export const mockDirectBuyAdmin = [
  { id: "db1", project_name: "مزرعة الواحة", user_name: "نور الدين", shares: 100, price_per_share: 95000, status: "pending", created_at: "2026-04-25" },
  { id: "db2", project_name: "برج بغداد", user_name: "ياسمين كريم", shares: 50, price_per_share: 240000, status: "approved", created_at: "2026-04-24" },
  { id: "db3", project_name: "مجمع الكرخ", user_name: "كريم علي", shares: 25, price_per_share: 170000, status: "postponed", created_at: "2026-04-23", admin_note: "بانتظار توفر سيولة" },
  { id: "db4", project_name: "صفا الذهبي", user_name: "هدى صبري", shares: 40, price_per_share: 115000, status: "completed", created_at: "2026-04-20" },
]

// ===== Holdings =====
export const mockHoldingsAdmin = [
  { id: "h1", user_name: "أحمد محمد", project_name: "مزرعة الواحة", shares: 50, current_value: 5000000 },
  { id: "h2", user_name: "علي حسن", project_name: "برج بغداد", shares: 20, current_value: 5000000 },
  { id: "h3", user_name: "محمد أحمد", project_name: "مجمع الكرخ", shares: 30, current_value: 5250000 },
  { id: "h4", user_name: "سارة محمود", project_name: "صفا الذهبي", shares: 25, current_value: 3000000 },
]

// ===== Contracts =====
export const mockContractsAdmin = [
  { id: "ct1", title: "عقد شراكة مزرعة الواحة", creator: "أحمد محمد", partners_count: 3, total_investment: 5000000, status: "active", created_at: "2026-04-15" },
  { id: "ct2", title: "عقد استثمار برج بغداد", creator: "علي حسن", partners_count: 2, total_investment: 8000000, status: "pending", created_at: "2026-04-22" },
  { id: "ct3", title: "عقد تسويق مجمع الكرخ", creator: "محمد أحمد", partners_count: 4, total_investment: 3000000, status: "ended", created_at: "2026-02-10" },
]

// ===== Transactions =====
export const mockTransactionsAdmin = [
  { id: "tx1", user_name: "أحمد محمد", type: "deal_buy", amount: 4750000, project: "مزرعة الواحة", created_at: "2026-04-25 14:30" },
  { id: "tx2", user_name: "علي حسن", type: "deal_sell", amount: 4750000, project: "مزرعة الواحة", created_at: "2026-04-25 14:30" },
  { id: "tx3", user_name: "محمد أحمد", type: "shares_received", amount: 50, project: "مزرعة الواحة", created_at: "2026-04-25 14:30" },
  { id: "tx4", user_name: "سارة محمود", type: "shares_sent", amount: 20, project: "برج بغداد", created_at: "2026-04-24 10:15" },
]

// ===== Fee Unit Requests =====
export const mockFeeRequestsAdmin = [
  { id: "fr1", user_name: "أحمد محمد", amount_requested: 50000, status: "pending", payment_method: "zaincash", note: "شحن وحدات للتداول", created_at: "2026-04-25 09:00" },
  { id: "fr2", user_name: "علي حسن", amount_requested: 100000, status: "approved", payment_method: "mastercard", note: "شحن دوري", created_at: "2026-04-20" },
  { id: "fr3", user_name: "محمد أحمد", amount_requested: 25000, status: "rejected", payment_method: "bank", note: "إعادة شحن", created_at: "2026-04-15" },
  { id: "fr4", user_name: "سارة محمود", amount_requested: 75000, status: "pending", payment_method: "zaincash", note: "—", created_at: "2026-04-25" },
]

// ===== Deal Fees =====
export const mockDealFeesAdmin = [
  { id: "df1", deal_id: "t1", project_name: "مزرعة الواحة", buyer: "أحمد محمد", fee_units: 95000, fee_percent: 2, deal_total: 4750000, created_at: "2026-04-25 14:30" },
  { id: "df2", deal_id: "t3", project_name: "مجمع الكرخ", buyer: "زين العبيدي", fee_units: 340000, fee_percent: 2, deal_total: 17000000, created_at: "2026-04-24" },
]

// ===== Users Admin =====
export const mockUsersAdmin = [
  { id: "u1", name: "أحمد محمد", phone: "+964 770 1234567", level: "advanced", kyc_status: "verified", total_trades: 12, reputation_score: 85, blocked: false, joined: "2026-01-15" },
  { id: "u2", name: "علي حسن", phone: "+964 770 2345678", level: "pro", kyc_status: "verified", total_trades: 45, reputation_score: 92, blocked: false, joined: "2025-11-20" },
  { id: "u3", name: "محمد أحمد", phone: "+964 770 3456789", level: "advanced", kyc_status: "verified", total_trades: 28, reputation_score: 78, blocked: false, joined: "2025-12-10" },
  { id: "u4", name: "سارة محمود", phone: "+964 770 4567890", level: "basic", kyc_status: "pending", total_trades: 3, reputation_score: 50, blocked: false, joined: "2026-04-22" },
  { id: "u5", name: "زين العبيدي", phone: "+964 770 5678901", level: "advanced", kyc_status: "verified", total_trades: 22, reputation_score: 80, blocked: false, joined: "2026-02-05" },
  { id: "u6", name: "نور الدين", phone: "+964 770 6789012", level: "pro", kyc_status: "verified", total_trades: 56, reputation_score: 95, blocked: false, joined: "2025-09-15" },
  { id: "u7", name: "ياسمين كريم", phone: "+964 770 7890123", level: "basic", kyc_status: "pending", total_trades: 1, reputation_score: 50, blocked: false, joined: "2026-04-23" },
  { id: "u8", name: "كريم علي", phone: "+964 770 8901234", level: "basic", kyc_status: "rejected", total_trades: 0, reputation_score: 30, blocked: false, joined: "2026-04-20" },
  { id: "u9", name: "حساب احتيالي", phone: "+964 770 9012345", level: "basic", kyc_status: "rejected", total_trades: 0, reputation_score: 0, blocked: true, joined: "2026-04-15" },
  { id: "u10", name: "هدى صبري", phone: "+964 770 0123456", level: "basic", kyc_status: "pending", total_trades: 2, reputation_score: 50, blocked: false, joined: "2026-04-24" },
]

// ===== Disputes =====
export const mockDisputesAdmin = [
  { id: "d1", trade_id: "t1247", project: "مزرعة الواحة", complainant: "أحمد محمد", respondent: "علي حسن", reason: "no_delivery", status: "open", created_at: "2026-04-25 10:30", details: "لم يتم تسليم الحصص بعد دفع المبلغ كاملاً" },
  { id: "d2", trade_id: "t1198", project: "برج بغداد", complainant: "محمد أحمد", respondent: "سارة محمود", reason: "fraud", status: "investigating", created_at: "2026-04-23 14:00", details: "محاولة احتيال - إثبات دفع مزور" },
  { id: "d3", trade_id: "t1150", project: "مجمع الكرخ", complainant: "زين العبيدي", respondent: "نور الدين", reason: "no_payment", status: "resolved", created_at: "2026-04-20", details: "تم الحل لصالح البائع - استرداد الحصص" },
]

const disputeReasonLabels: Record<string, string> = {
  no_payment: "لم يدفع الطرف الآخر",
  no_delivery: "لم يسلّم الحصص",
  fraud: "محاولة احتيال",
  abuse: "إساءة أو سلوك غير لائق",
  other: "سبب آخر",
}

export { disputeReasonLabels }

// ===== Ratings =====
export const mockRatingsAdmin = [
  { id: "r1", from_user: "أحمد محمد", to_user: "علي حسن", stars: 5, comment: "بائع موثوق، تواصل ممتاز", trade_id: "t1100", created_at: "2026-04-25" },
  { id: "r2", from_user: "علي حسن", to_user: "أحمد محمد", stars: 4, comment: "مشتري جدي", trade_id: "t1100", created_at: "2026-04-25" },
  { id: "r3", from_user: "محمد أحمد", to_user: "نور الدين", stars: 5, comment: "تجربة ممتازة", trade_id: "t1095", created_at: "2026-04-22" },
  { id: "r4", from_user: "سارة محمود", to_user: "زين العبيدي", stars: 2, comment: "تأخر في التسليم", trade_id: "t1080", created_at: "2026-04-18" },
]

// ===== Support Inbox =====
export const mockSupportTickets = [
  { id: "s1", user_name: "أحمد محمد", subject: "مشكلة في تأكيد صفقة #1247", type: "صفقة معلقة", priority: "high", status: "new", message: "الصفقة عالقة منذ ساعتين ولا يمكنني تأكيدها", created_at: "2026-04-25 14:00" },
  { id: "s2", user_name: "علي حسن", subject: "استفسار عن الترقية للمستوى المتقدم", type: "استفسار عام", priority: "low", status: "replied", message: "كم صفقة أحتاج لأرقى؟", created_at: "2026-04-24 10:30" },
  { id: "s3", user_name: "محمد أحمد", subject: "مشكلة في تحميل صور KYC", type: "مشكلة تقنية", priority: "medium", status: "in_progress", message: "الصور لا ترفع بنجاح", created_at: "2026-04-23 16:45" },
  { id: "s4", user_name: "سارة محمود", subject: "اقتراح ميزة جديدة", type: "اقتراح", priority: "low", status: "new", message: "أتمنى إضافة ميزة المفضلة للمشاريع", created_at: "2026-04-25 09:00" },
]

// ===== News Admin =====
export const mockNewsAdmin = [
  { id: "n1", title: "إطلاق برنامج السفير الجديد", category: "general", author: "رايلوس", is_pinned: true, is_important: false, status: "published", likes: 47, created_at: "2026-04-25" },
  { id: "n2", title: "افتتاح مشروع الواحة الزراعي", category: "project", author: "إدارة المنصة", is_pinned: false, is_important: true, status: "published", likes: 32, created_at: "2026-04-24" },
  { id: "n3", title: "تنبيه: تحديث رسوم التداول", category: "alert", author: "رايلوس", is_pinned: false, is_important: false, status: "published", likes: 18, created_at: "2026-04-23" },
  { id: "n4", title: "خبر مسودة - قيد الإعداد", category: "general", author: "رايلوس", is_pinned: false, is_important: false, status: "draft", likes: 0, created_at: "2026-04-25" },
]

// ===== Ads Admin =====
export const mockAdsAdmin = [
  { id: "ad1", title: "استثمر في مشاريع رايلوس", project_name: "مزرعة الواحة", clicks: 1247, impressions: 15000, status: "active", ends_at: "2026-05-30" },
  { id: "ad2", title: "احصل على عوائد 18%", project_name: "برج بغداد", clicks: 893, impressions: 9500, status: "active", ends_at: "2026-06-15" },
  { id: "ad3", title: "إعلان منتهي", project_name: "مجمع الكرخ", clicks: 2145, impressions: 28000, status: "expired", ends_at: "2026-04-15" },
]

// ===== System Offers Admin =====
export const mockSystemOffersAdmin = [
  { id: "so1", project_name: "مزرعة الواحة", type: "sell", price: 95000, shares: 100, status: "active", ends_at: "2026-05-15" },
  { id: "so2", project_name: "برج بغداد", type: "sell", price: 245000, shares: 50, status: "active", ends_at: "2026-05-20" },
]

// ===== Admins =====
export const mockAdminUsers = [
  { id: "a1", name: "Admin@Main", phone: "+964 770 0000001", role: "superadmin", permissions: 12, last_login: "2026-04-25 14:30", active: true },
  { id: "a2", name: "Admin@1", phone: "+964 770 0000002", role: "admin", permissions: 8, last_login: "2026-04-25 13:00", active: true },
  { id: "a3", name: "Admin@2", phone: "+964 770 0000003", role: "viewer", permissions: 3, last_login: "2026-04-24", active: true },
]

// ===== Fee Config Advanced (5 fees + history) =====
export const mockFeeConfigAdvanced = {
  id: 1,
  listing_fee_percent: 1,
  direct_buy_fee_percent: 1.5,
  auction_fee_percent: 2,
  contract_fee_percent: 2,
  quick_sell_fee_percent: 2,
  updated_at: "2026-04-20",
  updated_by: "Admin@Main",
}

export const mockFeeConfigHistory = [
  { id: "h1", changed_by: "Admin@Main", field: "auction_fee_percent", old_value: 1.5, new_value: 2, changed_at: "2026-04-20 14:00" },
  { id: "h2", changed_by: "Admin@1", field: "listing_fee_percent", old_value: 0.5, new_value: 1, changed_at: "2026-04-15" },
  { id: "h3", changed_by: "Admin@Main", field: "quick_sell_fee_percent", old_value: 1.5, new_value: 2, changed_at: "2026-04-10" },
]

// ===== Market State (current + history) =====
export const mockMarketStateAdvanced = {
  current_price: 100000,
  base_price: 95000,
  daily_change_pct: 5.2,
  market_open: true,
  trading_volume_24h: 45200000,
  trades_count_24h: 87,
  market_cap: 2400000000,
  last_updated: "2026-04-25 14:30",
}

export const mockMarketPriceHistory = [
  { id: "ph1", price: 100000, change: 2.3, recorded_at: "2026-04-25 14:00" },
  { id: "ph2", price: 97700, change: 1.5, recorded_at: "2026-04-25 12:00" },
  { id: "ph3", price: 96250, change: -0.8, recorded_at: "2026-04-25 10:00" },
  { id: "ph4", price: 97000, change: 1.2, recorded_at: "2026-04-25 08:00" },
  { id: "ph5", price: 95850, change: 0.5, recorded_at: "2026-04-25 06:00" },
  { id: "ph6", price: 95380, change: -1.0, recorded_at: "2026-04-24 22:00" },
  { id: "ph7", price: 96340, change: 1.8, recorded_at: "2026-04-24 20:00" },
  { id: "ph8", price: 94640, change: -0.5, recorded_at: "2026-04-24 18:00" },
]

// ===== Market Settings Advanced =====
export const mockMarketSettings = {
  market_open: true,
  auctions_enabled: true,
  quick_sell_enabled: true,
  direct_buy_enabled: true,
  contracts_enabled: true,
  trading_hours_start: "08:00",
  trading_hours_end: "22:00",
  deal_duration_minutes: 15,
  auction_min_duration_hours: 1,
  auction_max_duration_hours: 72,
  max_daily_trades: 50,
  min_trade_value: 10000,
  max_trade_value: 250000000,
  welcome_bonus: 1000,
  referral_bonus_percent: 2,
  min_kyc_for_pro: true,
  auto_approve_kyc: false,
}

// ===== Fee Units Admin (extended) =====
export const mockFeeUnitsRequestsAdmin = [
  { id: "fu1", user_name: "أحمد محمد", user_phone: "+964 770 1111111", amount_requested: 50000, current_balance: 35000, status: "pending", payment_method: "zain_cash", payment_reference: "ZC2026042512345", created_at: "2026-04-25 09:00", admin_note: "" },
  { id: "fu2", user_name: "علي حسن", user_phone: "+964 770 2222222", amount_requested: 100000, current_balance: 200000, status: "approved", payment_method: "ki_rafidain", payment_reference: "KI20260425", processed_by_name: "Admin@1", processed_at: "2026-04-20 11:30", created_at: "2026-04-20", admin_note: "تم التحقق من الإيصال" },
  { id: "fu3", user_name: "محمد أحمد", user_phone: "+964 770 3333333", amount_requested: 25000, current_balance: 0, status: "rejected", payment_method: "asia_hawala", payment_reference: "AH123", processed_by_name: "Admin@Main", processed_at: "2026-04-15", created_at: "2026-04-15", admin_note: "إيصال غير واضح" },
  { id: "fu4", user_name: "سارة محمود", user_phone: "+964 770 4444444", amount_requested: 75000, current_balance: 10000, status: "pending", payment_method: "zain_cash", payment_reference: "ZC2026042598765", created_at: "2026-04-25", admin_note: "" },
  { id: "fu5", user_name: "نور الدين", user_phone: "+964 770 5555555", amount_requested: 200000, current_balance: 150000, status: "auto_verified", payment_method: "ki_rafidain", payment_reference: "KIAUTO456", processed_at: "2026-04-22", created_at: "2026-04-22", admin_note: "تحقق تلقائي" },
]

const paymentLabels: Record<string, { label: string; icon: string }> = {
  zain_cash: { label: "زين كاش", icon: "📱" },
  ki_rafidain: { label: "كي الرافدين", icon: "🏦" },
  asia_hawala: { label: "آسيا حوالة", icon: "💸" },
}

export { paymentLabels }

// ===== Deal Fees Advanced =====
export const mockDealFeesAdvanced = [
  { id: "df1", deal_id: "t1", project_name: "مزرعة الواحة", buyer: "أحمد محمد", seller: "علي حسن", deal_total: 4750000, fee_percent: 2, fee_amount: 95000, status: "collected", created_at: "2026-04-25 14:30" },
  { id: "df2", deal_id: "t3", project_name: "مجمع الكرخ", buyer: "زين العبيدي", seller: "نور الدين", deal_total: 17000000, fee_percent: 2, fee_amount: 340000, status: "collected", created_at: "2026-04-24" },
  { id: "df3", deal_id: "t2", project_name: "برج بغداد", buyer: "محمد أحمد", seller: "سارة محمود", deal_total: 4900000, fee_percent: 2, fee_amount: 98000, status: "pending", created_at: "2026-04-25 13:15" },
  { id: "df4", deal_id: "t4", project_name: "صفا الذهبي", buyer: "ياسمين كريم", seller: "كريم علي", deal_total: 3450000, fee_percent: 2, fee_amount: 69000, status: "refunded", created_at: "2026-04-22" },
]
