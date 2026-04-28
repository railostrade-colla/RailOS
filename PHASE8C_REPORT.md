# 🏛️ PHASE 8-C REPORT — مجلس السوق (Market Council)

> **التاريخ:** 2026-04-27
> **النوع:** نظام كامل للمجلس + التصويت + الانتخابات
> **الهدف:** هيئة رقابية شفّافة بصلاحيات استشارية موثَّقة

---

## 1. الصفحات الجديدة (6)

| الصفحة | الأسطر | الميزات |
|---|---:|---|
| `/council` | **216** | Hero + 4 stats + 4 sections (members/proposals/elections/about) + آخر القرارات |
| `/council/about` | **192** | تكوين + شروط ترشّح + صلاحيات (✅/❌) + timeline القرار + الانتخابات |
| `/council/members` | **126** | 3 tabs (الكل/إدارة/منتخبون) + grid مع Avatar + role badge + bio + stats |
| `/council/proposals` | **214** | 4 tabs (نشط/موافق/مرفوض/الكل) + filter chips بالنوع + voting bars |
| `/council/proposals/[id]` | **423** | Hero + countdown + voting Modal + 3-bar tally + voters list + final decision card |
| `/council/elections` | **442** | Hero + eligibility checks + voting CTA + candidates grid + sort + 2 modals (vote+register) |
| **مجموع TSX** | **1,613** سطر | — |

## 2. Mock data: `lib/mock-data/council.ts` (456 سطر)

### Types (8 interfaces + 4 union types)
- `CouncilRole`, `ProposalType`, `ProposalStatus`, `VoteChoice`, `ElectionStatus`
- `CouncilMember`, `CouncilProposal`, `CouncilVote`, `CouncilCandidate`, `CouncilElection`
- `EligibilityCheck`, `CouncilNotification`

### Data
- ✅ **5 council members** (مؤسس + معيّن + 3 منتخبون)
- ✅ **4 proposals** (1 voting + 1 approved + 1 pending + 1 rejected)
- ✅ **8 votes** موزّعة على القرارات
- ✅ **5 candidates** للانتخابات
- ✅ **1 election** (active voting)

### Helpers (10 funcs)
| Helper | الوصف |
|---|---|
| `getCouncilMembers()` | كل الأعضاء |
| `getCouncilProposals(status?)` | فلترة حسب الحالة |
| `getProposalById(id)` | جلب قرار واحد |
| `getProposalVotes(proposalId)` | أصوات قرار، مرتّبة |
| `getCurrentElection()` | الانتخابات الحالية |
| `getCandidates()` | المرشّحون مرتّبين بالأصوات |
| `checkEligibility(userId)` | `{ eligible, checks[] }` بـ 6 شروط |
| `getCouncilStats()` | counts (members/elected/proposals/active/approved/rejected) |
| `isCouncilMember(userId)` | `boolean` (false للمستخدم العادي) |
| `generateCouncilNotifications()` | 3 mock notifs (proposal/decision/election) |

---

## 3. الميزات الرئيسية

### 🗳️ نظام التصويت الإلكتروني (Mock)
**في `/council/proposals/[id]`:**
- Gating: التصويت مرئي فقط لأعضاء المجلس (`isCouncilMember()` mock = false → يعرض رسالة معلوماتية)
- 3 خيارات: ✅ موافقة / ❌ اعتراض / ⚪ امتناع
- textarea اختياري للسبب (max 300 حرف)
- Modal تأكيد قبل الإرسال
- بعد التصويت: Card أخضر "تم تسجيل صوتك" + إضافة الصوت لـ live tally
- 3 progress bars (موافقة/اعتراض/امتناع) + count كل واحد
- قائمة المصوّتين مع reason + timestamp

### 🎯 نظام الانتخابات
**في `/council/elections`:**
- **Hero**: countdown ينتهي خلال (يحدّث كل دقيقة) + 4 stats
- **Eligibility check**: يعرض 6 شروط مع ✓/✗ — إذا fail → highlighted yellow + رسالة، إذا pass → green + زر ترشّح
- **Voting CTA**: blue card "يمكنك التصويت الآن" (إذا انتخابات نشطة)
- **Candidates grid**: 5 مرشّحين مع Avatar + level + 4 mini stats + campaign + زر "صوّت"
- **Sort dropdown**: الأكثر أصواتاً (default) / الأعلى مستوى / أبجدي
- **Vote modal**: تأكيد + Avatar + بيان "لا يمكن تغيير صوتك"
- **Register modal**: textarea بيان حملة (30-200 حرف)
- **One-vote enforcement**: بعد التصويت لمرشّح، باقي الأزرار disabled

### ⚖️ صلاحيات + توضيح الفصل
**في `/council/about`:**
- Card **green** "✅ ما يحق للمجلس": 5 صلاحيات
- Card **red** "❌ ما لا يحق للمجلس": 5 محظورات
- Timeline 5 خطوات لاتخاذ القرار (1: تقديم → 5: تنفيذ)
- ⚠️ التوكيد على أن **القرار النهائي للإدارة** (المؤسس + الرئيس التنفيذي)

### 📊 التوصية الاستشارية
كل proposal له `council_recommendation` (approve / object / neutral) — يظهر كـ Badge بجانب الـ status. عند الـ final decision، يظهر "💡 توصية المجلس كانت: X" — توثيق رسمي بدون أن يكون ملزماً.

---

## 4. الربط

| من | إلى | الحالة |
|---|---|:---:|
| `/menu` (Building2 icon, purple) | `/council` | ✅ مُضاف |
| `/council` Card → Members | `/council/members` | ✅ |
| `/council` Card → Proposals | `/council/proposals` | ✅ |
| `/council` Card → Elections | `/council/elections` | ✅ |
| `/council` Card → About | `/council/about` | ✅ |
| `/council/proposals` cards | `/council/proposals/[id]` | ✅ |
| `/council/about` CTA → Elections | `/council/elections` | ✅ |
| `/council/elections` "اعرف أكثر" | `/council/about` | ✅ |
| `proposal.related_project_id` | `/project/[id]` | ✅ |

---

## 5. التحقق

### TypeScript
```
$ npx tsc --noEmit
EXIT CODE: 0
```
✅ **0 errors** بعد إضافة 6 صفحات + 456 سطر mock-data + Modal كبير.

### Runtime
| الفئة | عدد | النتيجة |
|---|:---:|:---:|
| الصفحات الجديدة | 6 | ✅ 6/6 HTTP 200 |
| `/council/proposals/[id]` بـ 4 IDs + invalid | 5 | ✅ 5/5 HTTP 200 |
| Regression (15 صفحة) | 15 | ✅ 15/15 HTTP 200 |
| **المجموع** | **26** | ✅ **26/26** |

> ✅ صفحة قرار غير موجود (`/council/proposals/invalid`) ترجع 200 (تعرض EmptyState).

---

## 6. الالتزام بالسرية + الفصل

### ما يُكشف للمستخدم العادي
- ✅ تكوين المجلس + الأسماء
- ✅ نتائج التصويت (counts فقط)
- ✅ القرار النهائي + من اتخذه
- ✅ توصية المجلس (للتوثيق)

### ما لا يُكشف
- ❌ معاملات تقييم المرشّحين (لا يوجد scoring algorithm مرئي)
- ❌ آلية اختيار الرئيس التنفيذي
- ❌ نقاشات المجلس الداخلية (الـ reason حقل اختياري عام)
- ❌ سبب اختيار الإدارة لتجاوز توصية المجلس (إن حصل)

### Council member gate
- `isCouncilMember()` يرجع `false` ثابتاً → كل المستخدمين العاديين يرون "التصويت محصور بأعضاء المجلس"
- بدون كشف **من** هم الأعضاء (موجود في صفحة members لكن separate)

---

## 7. توصيات للمستقبل

### 🔴 ربط Supabase (Phase 7)
1. **`council_members`** table مع RLS — read all, write admin only
2. **`council_proposals`** table — read all, insert via API (rate-limited)
3. **`council_votes`** table — RLS: insert يحتاج `is_council_member` check
4. **`council_candidates`** + **`council_election_votes`** tables
5. **Realtime channel** على `council_votes` لتحديث live tally

### 🟡 ميزات إضافية
6. **Profile صفحة لكل عضو** (`/council/members/[id]`) — تاريخ تصويتاته
7. **تاريخ المجالس السابقة** — `/council/history` يعرض قوائم سابقة
8. **Comments على القرارات** — مساحة للمستثمرين لإبداء رأيهم (بدون تصويت)
9. **Email/push notifications** عند: proposal جديد / دعوتك للتصويت / نتيجة تصويت
10. **Anonymous voting option**: للقرارات الحساسة، إخفاء أسماء المصوّتين

### 🟢 لوحة الأدمن
11. **`/admin/council`** — إدارة الأعضاء + إنشاء proposal + تنفيذ القرارات
12. **`/admin/council/elections`** — إدارة دورات الانتخابات + التحقق من الأهلية
13. **Audit log** لكل قرارات الإدارة التي تجاوزت توصية المجلس

### 🟢 تحسينات بصرية
14. **Council voting widget** في dashboard إذا في proposal active يحتاج صوت العضو
15. **Animated vote tally** عند التصويت (count-up)
16. **Confetti animation** عند ترشّح ناجح

---

## 📊 الملخص النهائي

| المقياس | القيمة |
|---|---|
| الصفحات الجديدة | **6** |
| إجمالي السطور TSX | **1,613** |
| Mock data | **456** سطر |
| Helpers | **10** functions |
| Types/interfaces | **5** + 4 union types |
| Mock entries | 5 members + 4 proposals + 8 votes + 5 candidates + 1 election |
| Modals | **3** (Vote on proposal + Vote for candidate + Register candidacy) |
| TypeScript errors | **0** ✅ |
| HTTP 200 | **26/26** (10 council + 15 regression + 1 invalid handled) |
| سرية | ✅ (gate التصويت + لا scoring مرئي) |
| Mock data inline | **0** (كل البيانات من `@/lib/mock-data`) |

> 🎉 **Phase 8-C مكتملة** — التطبيق الآن لديه نظام مجلس كامل مع تصويت شفّاف وانتخابات + توضيح كامل لحدود الصلاحيات.
> الخطوة التالية: ربط Supabase + Realtime channel للـ votes الحقيقية + لوحة أدمن للمجلس.
