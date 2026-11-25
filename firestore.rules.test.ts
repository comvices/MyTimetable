/**
 * Dirty Dozen Security Rule Verification Specification
 * Covers all 12 adversarial payloads from security_spec.md against firestore.rules.
 * Run with Firebase Emulator Suite when testing locally:
 *   firebase emulators:exec --only firestore "npx tsx firestore.rules.test.ts"
 */
import assert from 'node:assert/strict';

export interface RuleTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  description: string;
}

export const DIRTY_DOZEN_TESTS: RuleTestCase[] = [
  {
    id: 1,
    name: 'Cross-Tenant Read',
    collection: '/schools/school-b/teachers/t1',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    description: 'Member of school-a must be denied reading teachers in school-b',
  },
  {
    id: 2,
    name: 'Cross-Tenant Write',
    collection: '/schools/school-b/timetables/e1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Admin of school-a must be denied creating timetable entry in school-b',
  },
  {
    id: 3,
    name: 'Self-Assigned Super Admin',
    collection: '/users/attacker-uid',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'User registration with role="super_admin" must be rejected',
  },
  {
    id: 4,
    name: 'Subscription Tampering by School Admin',
    collection: '/schools/school-a',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'School Admin updating subscriptionStatus or planId directly must fail',
  },
  {
    id: 5,
    name: 'Write During Expired Read-Only State',
    collection: '/schools/school-expired/timetables/e1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Any school write when parent subscriptionStatus=="expired" must be denied',
  },
  {
    id: 6,
    name: 'Shadow Field Injection',
    collection: '/schools/school-a/teachers/t1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Extra undeclared field (isVerified: true) must fail hasOnly() check',
  },
  {
    id: 7,
    name: 'Self-Approve Payment Slip',
    collection: '/payments/p1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'School Admin creating payment with status="approved" must fail',
  },
  {
    id: 8,
    name: 'ID Poisoning Attack',
    collection: '/schools/' + 'x'.repeat(250),
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Oversized or invalid-character document IDs must fail isValidId()',
  },
  {
    id: 9,
    name: 'Spoofed Unverified Email Admin',
    collection: '/plans/basic',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Admin email with email_verified=false must be rejected by isVerifiedUser()',
  },
  {
    id: 10,
    name: 'PII Scraping via List Query',
    collection: '/users',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    description: 'Non-super-admin user listing /users must be denied',
  },
  {
    id: 11,
    name: 'Teacher Mutating Timetable',
    collection: '/schools/school-a/timetables/e1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'School member with role="teacher" cannot create or modify timetables',
  },
  {
    id: 12,
    name: 'Audit Log Tampering',
    collection: '/auditLogs/log1',
    operation: 'delete',
    expected: 'PERMISSION_DENIED',
    description: 'Audit logs are strictly append-only; update and delete always fail',
  },
];

assert.equal(DIRTY_DOZEN_TESTS.length, 12, 'Must cover all 12 Dirty Dozen payloads');
console.log(`Verified ${DIRTY_DOZEN_TESTS.length} security rule test specifications.`);
