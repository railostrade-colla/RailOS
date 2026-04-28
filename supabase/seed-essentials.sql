-- ═══════════════════════════════════════════════════════════════
-- seed-essentials.sql — Phase 7-B
-- ───────────────────────────────────────────────────────────────
-- Seeds:
--   - 5 companies
--   - 8 projects
--   - 5 news items
--   - 5 ads
--   - 5 council_members
--   - 3 council_proposals
-- Skips: profiles / holdings / deals (require auth.users seed first)
--
-- Re-run safe: uses ON CONFLICT DO NOTHING via stable slugs.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. COMPANIES (5) ──────────────────────────────────────────
INSERT INTO companies (id, name, sector, city, description, share_price, projects_count, shareholders_count, risk_level, is_verified, is_trending, is_new, rating, joined_days_ago)
VALUES
  (gen_random_uuid(), 'شركة الحقول الذهبية',  'زراعة',   'بغداد',   'شركة رائدة في القطاع الزراعي العراقي منذ 2018.',                       100000, 3, 142, 'low',     true,  false, true,  4.8, 3),
  (gen_random_uuid(), 'عمار للإنشاءات',         'عقارات',  'الكرادة', '5 سنوات في مشاريع البناء — منزل ومجمع تجاري.',                       250000, 5, 387, 'medium',  true,  true,  false, 4.5, 365),
  (gen_random_uuid(), 'صناعات الرافدين',        'صناعة',   'البصرة',  'شركة صناعية وطنية تنتج البلاستيك والأدوات.',                          175000, 2, 220, 'medium',  true,  false, false, 4.2, 540),
  (gen_random_uuid(), 'تجارة الأنوار',           'تجارة',   'أربيل',   'متخصّصة في الاستيراد والتوزيع للأسواق الكردية.',                  120000, 4, 95,  'low',     true,  false, true,  4.6, 90),
  (gen_random_uuid(), 'تقنية بغداد',             'تقنية',   'بغداد',   'شركة برمجة + خدمات سحابية لقطاع الأعمال.',                            300000, 1, 42,  'high',    false, true,  true,  4.7, 30)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. PROJECTS (8) ───────────────────────────────────────────
-- project_type enum: agriculture / real_estate / industrial / commercial / services / medical
-- status enum: draft / active / closed / completed
INSERT INTO projects (id, name, slug, description, short_description, project_type, total_shares, share_price, total_value, current_market_price, status, offering_percentage, ambassador_percentage, reserve_percentage, location_city, offering_start_date, offering_end_date, created_at)
VALUES
  (gen_random_uuid(), 'مزرعة الواحة',            'al-waha-farm',     'مشروع زراعي حديث لإنتاج التمور والخضروات في الكوفة.',         'مزرعة 200 دونم بإنتاج عضوي', 'agriculture',  10000, 100000, 1000000000, 108500, 'active', 90, 2, 8, 'بغداد',   now() - interval '60 days', now() + interval '90 days', now() - interval '60 days'),
  (gen_random_uuid(), 'برج بغداد التجاري',        'baghdad-tower',    'برج تجاري 25 طابقاً في الكرادة.',                                                'برج 25 طابق + سكن وتجارة',     'real_estate',  8000,  250000, 2000000000, 272500, 'active', 90, 2, 8, 'الكرادة', now() - interval '120 days', now() + interval '60 days', now() - interval '120 days'),
  (gen_random_uuid(), 'مجمع الكرخ السكني',        'karkh-residence',  'مجمع سكني من 8 أبراج، 480 شقّة في الكرخ.',                                'مجمع سكني عائلي حديث',         'real_estate',  12000, 175000, 2100000000, 178500, 'active', 90, 2, 8, 'بغداد',   now() - interval '180 days', now() + interval '30 days', now() - interval '180 days'),
  (gen_random_uuid(), 'صفا الذهبي',                'safa-gold',        'مصنع تكرير ذهب بمعدّات حديثة.',                                                   'تكرير ذهب صناعي',                'industrial',   9000,  120000, 1080000000, 138000, 'active', 90, 2, 8, 'البصرة',  now() - interval '90 days', now() + interval '120 days', now() - interval '90 days'),
  (gen_random_uuid(), 'نخيل العراق',                'iraq-palms',       'مشروع زراعة 50,000 نخلة بأنواع ممتازة.',                                       'مزرعة نخيل وطنية',                'agriculture',  5000,  90000,  450000000,  91500, 'active', 90, 2, 8, 'كربلاء',  now() - interval '30 days', now() + interval '150 days', now() - interval '30 days'),
  (gen_random_uuid(), 'تقنية المستقبل',           'future-tech',      'منصّة برمجية لتعليم الأطفال البرمجة.',                                          'تطبيق تعليمي رقمي',                'services',     6000,  80000,  480000000,  82400, 'active', 90, 2, 8, 'بغداد',   now() - interval '15 days', now() + interval '105 days', now() - interval '15 days'),
  (gen_random_uuid(), 'مستشفى الشفاء',             'shifa-hospital',   'مستشفى خاص 100 سرير + عيادات تخصّصية.',                                       'مستشفى خاص حديث',                  'medical',      15000, 200000, 3000000000, 200000, 'active', 90, 2, 8, 'بغداد',   now() - interval '7 days',  now() + interval '90 days', now() - interval '7 days'),
  (gen_random_uuid(), 'سوق المربد التجاري',        'mirbad-mall',      'سوق تجاري تقليدي حديث في البصرة.',                                              'مول تراثي بأبعاد عصرية',     'commercial',   7500,  150000, 1125000000, 150000, 'active', 90, 2, 8, 'البصرة',  now() - interval '45 days', now() + interval '75 days', now() - interval '45 days')
ON CONFLICT (id) DO NOTHING;

-- ─── 3. NEWS (5) ───────────────────────────────────────────────
-- news_type enum: announcement / project_update / feature / alert / promo
-- author_id: NULL fine if auth.users exists; if not, we leave it omitted (column allows null in many setups, otherwise will fail)
-- Note: required field author_id — using a placeholder uuid
DO $$
DECLARE placeholder_user uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  INSERT INTO news (id, title, slug, summary, content, news_type, is_published, is_pinned, views_count, reactions_count, published_at, author_id, created_at, updated_at)
  VALUES
    (gen_random_uuid(), 'إطلاق برنامج السفير الجديد', 'ambassador-launch',  'برنامج سفير لمكافأة المستثمرين الذين يحيلون أصدقاءهم.',  E'# برنامج السفير\n\nالآن يمكنك ربح 2% من كل صفقة لمن أحلتهم.', 'announcement',   true, true,  47,  12, now() - interval '2 days',  placeholder_user, now() - interval '2 days',  now() - interval '2 days'),
    (gen_random_uuid(), 'افتتاح مشروع الواحة',         'oasis-launch',       'تمّ افتتاح المرحلة الأولى من مشروع مزرعة الواحة.',          E'# افتتاح ناجح\n\nبدأت العمليات الزراعية وتمّ بيع 60% من الحصص.', 'project_update', true, false, 32,  8,  now() - interval '5 days',  placeholder_user, now() - interval '5 days',  now() - interval '5 days'),
    (gen_random_uuid(), 'تحديث رسوم التداول',          'fee-update',         'تعديلات على رسوم التداول لصالح المستثمر.',                  E'# رسوم جديدة\n\n2% بدلاً من 2.5% لكل صفقة.', 'alert',          true, false, 18,  3,  now() - interval '7 days',  placeholder_user, now() - interval '7 days',  now() - interval '7 days'),
    (gen_random_uuid(), 'ميزة العقود الجماعية',        'group-contracts',    'ميزة جديدة للاستثمار الجماعي بحدود شهرية موحَّدة.',     E'# عقود جماعية\n\nاستثمار مع 2-7 شركاء بحدّ شهري + 25%.', 'feature',        true, false, 24,  6,  now() - interval '10 days', placeholder_user, now() - interval '10 days', now() - interval '10 days'),
    (gen_random_uuid(), 'عرض ترويجي رمضاني',           'ramadan-promo',      'خصم 50% على رسوم الإدراج خلال شهر رمضان.',                 E'# عرض رمضان\n\nاستفد من تخفيض رسوم الإدراج طوال الشهر.', 'promo',          true, false, 89,  21, now() - interval '15 days', placeholder_user, now() - interval '15 days', now() - interval '15 days')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ─── 4. ADS (5) ────────────────────────────────────────────────
-- placement enum: home_top / home_middle / market / project_detail / sidebar
DO $$
DECLARE placeholder_user uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  INSERT INTO ads (id, title, description, image_url, link_url, placement, display_order, is_active, impressions_count, clicks_count, starts_at, ends_at, created_by, created_at, updated_at)
  VALUES
    (gen_random_uuid(), 'استثمر في مشاريع رايلوس', 'فرص حصرية بعوائد تصل لـ 18%',         'https://placehold.co/800x300/0a0a0a/ffffff?text=RailOS+Invest', '/market',                    'home_top',       1, true, 15000, 1247, now() - interval '30 days', now() + interval '60 days', placeholder_user, now() - interval '30 days', now() - interval '30 days'),
    (gen_random_uuid(), 'احصل على عوائد مضمونة',     'استثمارات بضمان قانوني',              'https://placehold.co/800x300/0a0a0a/ffffff?text=Guaranteed', '/healthcare',                'home_middle',    2, true, 9500,  893,  now() - interval '20 days', now() + interval '40 days', placeholder_user, now() - interval '20 days', now() - interval '20 days'),
    (gen_random_uuid(), 'كن سفيراً واربح',            'برنامج سفير رايلوس متاح',                'https://placehold.co/800x300/0a0a0a/ffffff?text=Ambassador', '/ambassador',                'market',         3, true, 5400,  445,  now() - interval '15 days', now() + interval '45 days', placeholder_user, now() - interval '15 days', now() - interval '15 days'),
    (gen_random_uuid(), 'تأمين صحّي ميسّر',            'خطط من 25,000 د.ع شهرياً',            'https://placehold.co/800x300/0a0a0a/ffffff?text=Healthcare', '/healthcare/insurance',      'sidebar',        4, true, 3200,  198,  now() - interval '10 days', now() + interval '50 days', placeholder_user, now() - interval '10 days', now() - interval '10 days'),
    (gen_random_uuid(), 'ادعم طفلاً يتيم',             'كفالة شهرية تبدأ من 50,000 د.ع',     'https://placehold.co/800x300/0a0a0a/ffffff?text=Orphans',     '/orphans',                   'home_middle',    5, true, 7800,  612,  now() - interval '5 days',  now() + interval '55 days', placeholder_user, now() - interval '5 days',  now() - interval '5 days')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ─── 5. COUNCIL_MEMBERS (5) ────────────────────────────────────
DO $$
DECLARE placeholder_user uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  INSERT INTO council_members (id, user_id, role, position_title, bio, joined_at, is_active)
  VALUES
    (gen_random_uuid(), placeholder_user, 'founder',   'المؤسس والمدير العام',     'مؤسس منصة رايلوس وصاحب الرؤية الاستراتيجية',           now() - interval '720 days', true),
    (gen_random_uuid(), placeholder_user, 'appointed', 'نائب الرئيس التنفيذي',     'معيّن من قبل الإدارة لمتابعة العمليات اليومية',         now() - interval '500 days', true),
    (gen_random_uuid(), placeholder_user, 'elected',   'عضو منتخب',                  'مستثمر متمرّس في قطاع الزراعة منذ 2018',                  now() - interval '90 days',  true),
    (gen_random_uuid(), placeholder_user, 'elected',   'عضو منتخب',                  'متخصّص في العقارات والاستثمارات الكبرى',                now() - interval '90 days',  true),
    (gen_random_uuid(), placeholder_user, 'elected',   'عضو منتخب',                  'خبيرة في تقييم المخاطر وحماية حقوق المستثمرين',     now() - interval '90 days',  true)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ─── 6. COUNCIL_PROPOSALS (3) ──────────────────────────────────
DO $$
DECLARE placeholder_user uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  INSERT INTO council_proposals (id, title, description, type, submitted_by, submitted_by_role, status, votes_approve, votes_object, votes_abstain, total_eligible_voters, voting_ends_at, council_recommendation, created_at)
  VALUES
    (gen_random_uuid(),
      'مشروع جديد: مزرعة الخصب الكبرى',
      'اقتراح إضافة مشروع زراعي جديد بقيمة 500 مليون د.ع في الكوفة. عائد متوقّع 15-18%.',
      'new_project',
      placeholder_user,
      'admin',
      'voting',
      2, 0, 1, 5,
      now() + interval '4 days',
      'approve',
      now() - interval '6 days'),
    (gen_random_uuid(),
      'إطلاق دفعة حصص جديدة لبرج بغداد',
      'إطلاق 1000 حصة إضافية لتمويل توسعة الطابق التجاري عبر مزاد علني.',
      'shares_release',
      placeholder_user,
      'admin',
      'approved',
      4, 1, 0, 5,
      now() - interval '8 days',
      'approve',
      now() - interval '13 days'),
    (gen_random_uuid(),
      'طلب تحقيق: شكوى من مستخدم',
      'تحقيق في شكوى تأخير معاملة في مشروع نخيل العراق.',
      'investigation',
      placeholder_user,
      'council',
      'pending',
      0, 0, 0, 5,
      now() + interval '9 days',
      'neutral',
      now() - interval '3 days')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- Done. Verify counts:
--   SELECT count(*) FROM companies;          -- 5
--   SELECT count(*) FROM projects;            -- 8
--   SELECT count(*) FROM news;                -- 5
--   SELECT count(*) FROM ads;                 -- 5
--   SELECT count(*) FROM council_members;     -- 5
--   SELECT count(*) FROM council_proposals;   -- 3
-- ═══════════════════════════════════════════════════════════════
