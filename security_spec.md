# Security Specification & Payload-First TDD (`security_spec.md`)

## 1. Data Invariants
1. **Strict Tenant Isolation**: Every school resource under `/schools/{schoolId}/*` is accessible ONLY if the authenticated user is an active member in `/schools/{schoolId}/members/{request.auth.uid}` or a verified Platform Super Admin (`isSuperAdmin()`).
2. **Subscription Write Gate (Read-Only on Expiry)**: Mutations to school scheduling/master data (`/schools/{schoolId}/teachers`, `subjects`, `classrooms`, `rooms`, `timeSlots`, `activities`, `timetables`, `scheduleVersions`) MUST fail when the parent `/schools/{schoolId}` has `subscriptionStatus` in `['expired', 'suspended', 'cancelled']`.
3. **No Frontend Privilege Escalation**: Users creating `/users/{uid}` cannot assign themselves `super_admin`. Users cannot elevate `subscriptionStatus`, `planId`, or `currentPeriodEnd` on `/schools/{schoolId}` or `/subscriptions/{id}`; only `isSuperAdmin()` can approve subscription renewals.
4. **PII Isolation**: `/schoolSlugs/{slug}` exposes ONLY public login branding (`nameTh`, `nameEn`, `logoUrl`, `loginCoverUrl`, `backgroundUrl`, `primaryColor`, `secondaryColor`, `welcomeMessage`) and NEVER stores phone numbers, emails, addresses, or billing fields.
5. **Payment & Renewal Integrity**: Renewal requests created by a school admin must use `method == 'bank_transfer'`, start strictly in `status == 'pending_verification'`, and have no `verifiedBy` field; ONLY `isSuperAdmin()` can transition `status` to `'approved'` or `'rejected'` and extend the school's subscription period.
6. **Temporal & Identity Integrity**: `createdAt` uses `request.time`, `updatedAt` uses `request.time`, and immutable identifiers (`id`, `schoolId`, `ownerUid`, `createdBy`) cannot be rewritten on update.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Cross-Tenant Read**: User from `school-a` attempts `get(/schools/school-b/teachers/t1)`. -> Expected: `PERMISSION_DENIED`.
2. **Cross-Tenant Write**: User from `school-a` attempts `create(/schools/school-b/timetables/e1)`. -> Expected: `PERMISSION_DENIED`.
3. **Self-Assigned Super Admin**: New user writes `/users/{uid}` with `{ role: "super_admin" }`. -> Expected: `PERMISSION_DENIED`.
4. **Subscription Tampering by School Admin**: School Admin updates `/schools/{schoolId}` setting `subscriptionStatus: "active"` and `planId: "premium"`. -> Expected: `PERMISSION_DENIED`.
5. **Write During Expired Read-Only State**: School Admin tries creating a timetable entry when parent school `subscriptionStatus == 'expired'`. -> Expected: `PERMISSION_DENIED`.
6. **Shadow Field Injection**: Client sends extra ghost field `{ isVerified: true, adminBypass: 1 }` on `/schools/{schoolId}/teachers/t1`. -> Expected: `PERMISSION_DENIED` (blocked by `hasOnly()`).
7. **Self-Approve Payment Slip**: School Admin creates `/payments/p1` with `status: "approved"` directly. -> Expected: `PERMISSION_DENIED`.
8. **ID Poisoning Attack**: Client attempts to create `/schools/../../etc/passwd` or 1.5KB string document ID. -> Expected: `PERMISSION_DENIED` (blocked by `isValidId()`).
9. **Spoofed Unverified Email Admin**: User with `email: "phratchayawit.sri@gmail.com"` and `email_verified: false` tries Super Admin action. -> Expected: `PERMISSION_DENIED`.
10. **PII Scraping via List Query**: Signed-in user runs blanket `list` on `/users` or `/schools`. -> Expected: `PERMISSION_DENIED` (list restricted to owner/member/super-admin).
11. **Teacher Mutating Timetable**: User with role `teacher` in `/schools/{schoolId}/members/{uid}` attempts to write `/schools/{schoolId}/timetables/e1`. -> Expected: `PERMISSION_DENIED`.
12. **Audit Log Tampering**: School Admin attempts to `update` or `delete` `/auditLogs/{logId}` to erase tracks. -> Expected: `PERMISSION_DENIED`.
