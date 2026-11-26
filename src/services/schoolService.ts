import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';
import { generateId, sanitizeSlug } from '../lib/tenant';
import { AuditLog, School, SchoolInvite, SchoolMember } from '../types/saas';
import {
  AcademicYear,
  ActivityLock,
  Classroom,
  Department,
  Room,
  ScheduleHistory,
  ScheduleVersion,
  Subject,
  Teacher,
  TimeSlot,
  TimetableEntry,
} from '../types/school';

export interface ActorInfo {
  uid: string;
  email: string;
  displayName: string;
  username?: string;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

export async function writeAuditLog(
  schoolId: string,
  actor: ActorInfo,
  action: string,
  targetType: string,
  targetId = '',
  details = ''
): Promise<void> {
  const logId = generateId('log');
  const path = `auditLogs/${logId}`;
  try {
    await setDoc(doc(db, 'auditLogs', logId), {
      id: logId,
      schoolId: schoolId || 'platform',
      actorUid: actor.uid,
      actorEmail: (actor.email || '').slice(0, 200),
      action: action.slice(0, 100),
      targetType: targetType.slice(0, 80),
      targetId: targetId.slice(0, 128),
      details: details.slice(0, 600),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Audit log write skipped:', err, path);
  }
}

export async function createSchoolTenantAndTrial(
  input: {
    nameTh: string;
    nameEn?: string;
    slug: string;
    province?: string;
    phone?: string;
    planId: string;
    trialDays: number;
  },
  actor: ActorInfo
): Promise<{ schoolId: string; slug: string }> {
  const cleanSlug = sanitizeSlug(input.slug);
  if (cleanSlug.length < 2) {
    throw new Error('Subdomain ต้องมีตัวอักษรภาษาอังกฤษหรือตัวเลขอย่างน้อย 2 ตัวอักษร');
  }

  const slugRef = doc(db, 'schoolSlugs', cleanSlug);
  const existingSlug = await getDoc(slugRef);
  if (existingSlug.exists()) {
    throw new Error('Subdomain นี้ถูกใช้งานแล้ว กรุณาเลือกชื่ออื่น');
  }

  const schoolId = generateId('sch');
  const subId = generateId('sub');
  const trialEndsDate = new Date(Date.now() + Math.max(1, input.trialDays) * 86400000);
  const trialEndsTs = Timestamp.fromDate(trialEndsDate);

  const batch = writeBatch(db);

  batch.set(doc(db, 'schools', schoolId), {
    id: schoolId,
    slug: cleanSlug,
    ownerUid: actor.uid,
    nameTh: input.nameTh.trim().slice(0, 200),
    nameEn: (input.nameEn || '').trim().slice(0, 200),
    province: (input.province || '').trim().slice(0, 100),
    phone: (input.phone || '').trim().slice(0, 40),
    email: (actor.email || '').slice(0, 200),
    primaryColor: '#0f3d75',
    secondaryColor: '#1e6fb8',
    welcomeMessage: 'ยินดีต้อนรับสู่ระบบบริหารจัดการตารางสอนออนไลน์',
    planId: input.planId || 'professional',
    subscriptionStatus: 'trialing',
    trialEndsAt: trialEndsTs,
    teacherCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(slugRef, {
    slug: cleanSlug,
    schoolId,
    ownerUid: actor.uid,
    nameTh: input.nameTh.trim().slice(0, 200),
    nameEn: (input.nameEn || '').trim().slice(0, 200),
    primaryColor: '#0f3d75',
    secondaryColor: '#1e6fb8',
    welcomeMessage: 'ยินดีต้อนรับสู่ระบบบริหารจัดการตารางสอนออนไลน์',
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'schools', schoolId, 'members', actor.uid), {
    uid: actor.uid,
    email: (actor.email || '').slice(0, 200),
    displayName: (actor.displayName || actor.email || 'ผู้ดูแลโรงเรียน').slice(0, 150),
    role: 'school_admin',
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'subscriptions', subId), {
    id: subId,
    schoolId,
    ownerUid: actor.uid,
    planId: input.planId || 'professional',
    status: 'trialing',
    trialEndsAt: trialEndsTs,
    autoRenew: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'users', actor.uid), {
    schoolId,
    schoolSlug: cleanSlug,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `schools/${schoolId}`);
  }

  await writeAuditLog(
    schoolId,
    actor,
    'SCHOOL_CREATED',
    'school',
    schoolId,
    `Created school ${input.nameTh} (${cleanSlug})`
  );

  return { schoolId, slug: cleanSlug };
}

export async function uploadBrandingAsset(
  _schoolId: string,
  assetName: 'logo' | 'login-cover' | 'background',
  blob: Blob
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ภาพได้'));
    reader.readAsDataURL(blob);
  });

  const maxLen = assetName === 'logo' ? 590000 : 790000;
  if (dataUrl.length > maxLen) {
    throw new Error('ไฟล์ภาพมีขนาดใหญ่เกินขีดจำกัด กรุณาเลือกภาพที่เล็กลง');
  }
  return dataUrl;
}

const ALLOWED_SCHOOL_BRANDING_KEYS = new Set([
  'nameTh',
  'nameEn',
  'schoolCode',
  'affiliation',
  'address',
  'province',
  'district',
  'subdistrict',
  'postalCode',
  'phone',
  'email',
  'website',
  'directorName',
  'academicYear',
  'semester',
  'logoUrl',
  'loginCoverUrl',
  'backgroundUrl',
  'primaryColor',
  'secondaryColor',
  'welcomeMessage',
  'teacherCount',
]);

export async function updateSchoolProfileAndBranding(
  school: School,
  updates: Partial<School>,
  actor: ActorInfo
): Promise<void> {
  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (ALLOWED_SCHOOL_BRANDING_KEYS.has(k) && v !== undefined) {
      filtered[k] = v;
    }
  }

  const batch = writeBatch(db);
  batch.update(doc(db, 'schools', school.id), {
    ...filtered,
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'schoolSlugs', school.slug), {
    nameTh: String(filtered.nameTh ?? school.nameTh).slice(0, 200),
    nameEn: String(filtered.nameEn ?? school.nameEn ?? '').slice(0, 200),
    logoUrl: String(filtered.logoUrl ?? school.logoUrl ?? '').slice(0, 600000),
    loginCoverUrl: String(filtered.loginCoverUrl ?? school.loginCoverUrl ?? '').slice(0, 800000),
    backgroundUrl: String(filtered.backgroundUrl ?? school.backgroundUrl ?? '').slice(0, 800000),
    primaryColor: String(filtered.primaryColor ?? school.primaryColor ?? '#0f3d75').slice(0, 20),
    secondaryColor: String(filtered.secondaryColor ?? school.secondaryColor ?? '#1e6fb8').slice(0, 20),
    welcomeMessage: String(filtered.welcomeMessage ?? school.welcomeMessage ?? '').slice(0, 300),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `schools/${school.id}`);
  }

  await writeAuditLog(
    school.id,
    actor,
    'SCHOOL_BRANDING_UPDATED',
    'school',
    school.id,
    `Updated profile & branding for ${school.slug}`
  );
}

export async function upsertSchoolDoc(
  schoolId: string,
  collectionName: string,
  docId: string,
  payload: Record<string, unknown>,
  isNew: boolean
): Promise<void> {
  const path = `schools/${schoolId}/${collectionName}/${docId}`;
  const ref = doc(db, 'schools', schoolId, collectionName, docId);
  const clean = stripUndefined(payload);
  delete clean.createdAt;
  delete clean.updatedAt;

  try {
    if (isNew) {
      await setDoc(ref, {
        ...clean,
        id: docId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...clean,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteSchoolDoc(
  schoolId: string,
  collectionName: string,
  docId: string
): Promise<void> {
  const path = `schools/${schoolId}/${collectionName}/${docId}`;
  try {
    await deleteDoc(doc(db, 'schools', schoolId, collectionName, docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function activateSchoolAcademicYear(
  schoolId: string,
  yearId: string
): Promise<void> {
  const path = `schools/${schoolId}/academicYears`;
  try {
    const snap = await getDocs(collection(db, 'schools', schoolId, 'academicYears'));
    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      batch.update(d.ref, {
        isActive: d.id === yearId,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function syncSchoolTeacherCount(schoolId: string, count: number): Promise<void> {
  try {
    await updateDoc(doc(db, 'schools', schoolId), {
      teacherCount: Math.max(0, count),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-admin schedulers may not update school root teacherCount; ignore safely
  }
}

export async function saveTimetableEntryTransaction(
  schoolId: string,
  entry: Omit<TimetableEntry, 'createdAt' | 'updatedAt'>,
  expectedRevision: number | null,
  actor: ActorInfo
): Promise<void> {
  const entryRef = doc(db, 'schools', schoolId, 'timetables', entry.id);
  const path = `schools/${schoolId}/timetables/${entry.id}`;

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(entryRef);
      if (snap.exists()) {
        const current = snap.data() as TimetableEntry;
        if (expectedRevision !== null && current.revision !== expectedRevision) {
          throw new Error('ข้อมูลคาบเรียนถูกแก้ไขโดยผู้ใช้อื่น กรุณารีเฟรชและลองอีกครั้ง');
        }
        tx.update(entryRef, {
          academicYearId: entry.academicYearId,
          dayOfWeek: entry.dayOfWeek,
          periodNumber: entry.periodNumber,
          classroomId: entry.classroomId,
          subjectId: entry.subjectId,
          teacherId: entry.teacherId,
          roomId: entry.roomId || '',
          revision: (current.revision || 1) + 1,
          updatedBy: actor.uid,
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(entryRef, {
          id: entry.id,
          academicYearId: entry.academicYearId,
          dayOfWeek: entry.dayOfWeek,
          periodNumber: entry.periodNumber,
          classroomId: entry.classroomId,
          subjectId: entry.subjectId,
          teacherId: entry.teacherId,
          roomId: entry.roomId || '',
          revision: Math.max(1, entry.revision || 1),
          updatedBy: actor.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function recordScheduleHistory(
  schoolId: string,
  academicYearId: string,
  action: string,
  summary: string,
  actor: ActorInfo
): Promise<void> {
  const histId = generateId('hist');
  try {
    await setDoc(doc(db, 'schools', schoolId, 'scheduleHistory', histId), {
      id: histId,
      academicYearId,
      action: action.slice(0, 80),
      summary: summary.slice(0, 300),
      actorUid: actor.uid,
      actorEmail: (actor.email || '').slice(0, 200),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Schedule history write skipped:', err);
  }
}

export async function createScheduleVersionSnapshot(
  schoolId: string,
  academicYearId: string,
  name: string,
  entries: TimetableEntry[],
  actor: ActorInfo
): Promise<void> {
  const versionId = generateId('ver');
  const trimmed = entries.slice(0, 800).map((e) => ({
    dayOfWeek: e.dayOfWeek,
    periodNumber: e.periodNumber,
    classroomId: e.classroomId,
    subjectId: e.subjectId,
    teacherId: e.teacherId,
    roomId: e.roomId || '',
  }));

  try {
    await setDoc(doc(db, 'schools', schoolId, 'scheduleVersions', versionId), {
      id: versionId,
      academicYearId,
      name: name.trim().slice(0, 150),
      entryCount: trimmed.length,
      entries: trimmed,
      createdBy: actor.uid,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `schools/${schoolId}/scheduleVersions/${versionId}`);
  }
}

export async function restoreScheduleVersionSnapshot(
  schoolId: string,
  version: ScheduleVersion,
  currentEntries: TimetableEntry[],
  actor: ActorInfo
): Promise<void> {
  const path = `schools/${schoolId}/timetables`;
  try {
    const existingForYear = currentEntries.filter((e) => e.academicYearId === version.academicYearId);
    const ops: Array<(b: ReturnType<typeof writeBatch>) => void> = [];

    existingForYear.forEach((e) => {
      ops.push((b) => b.delete(doc(db, 'schools', schoolId, 'timetables', e.id)));
    });

    version.entries.forEach((snap) => {
      const id = generateId('tt');
      ops.push((b) =>
        b.set(doc(db, 'schools', schoolId, 'timetables', id), {
          id,
          academicYearId: version.academicYearId,
          dayOfWeek: snap.dayOfWeek,
          periodNumber: snap.periodNumber,
          classroomId: snap.classroomId,
          subjectId: snap.subjectId,
          teacherId: snap.teacherId,
          roomId: snap.roomId || '',
          revision: 1,
          updatedBy: actor.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    });

    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(db);
      ops.slice(i, i + 400).forEach((fn) => fn(batch));
      await batch.commit();
    }

    await recordScheduleHistory(
      schoolId,
      version.academicYearId,
      'RESTORE_VERSION',
      `กู้คืนเวอร์ชัน: ${version.name}`,
      actor
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function copyTimetableBetweenAcademicYears(
  schoolId: string,
  sourceAcademicYearId: string,
  targetAcademicYearId: string,
  actor: ActorInfo
): Promise<number> {
  const path = `schools/${schoolId}/timetables`;
  try {
    const sourceSnap = await getDocs(
      query(
        collection(db, 'schools', schoolId, 'timetables'),
        where('academicYearId', '==', sourceAcademicYearId)
      )
    );
    const sourceEntries = sourceSnap.docs.map((d) => d.data() as TimetableEntry);
    if (sourceEntries.length === 0) return 0;

    for (let i = 0; i < sourceEntries.length; i += 400) {
      const batch = writeBatch(db);
      sourceEntries.slice(i, i + 400).forEach((src) => {
        const newId = generateId('tt');
        batch.set(doc(db, 'schools', schoolId, 'timetables', newId), {
          id: newId,
          academicYearId: targetAcademicYearId,
          dayOfWeek: src.dayOfWeek,
          periodNumber: src.periodNumber,
          classroomId: src.classroomId,
          subjectId: src.subjectId,
          teacherId: src.teacherId,
          roomId: src.roomId || '',
          revision: 1,
          updatedBy: actor.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }

    await recordScheduleHistory(
      schoolId,
      targetAcademicYearId,
      'COPY_YEAR',
      `คัดลอกตารางจำนวน ${sourceEntries.length} คาบจากปีการศึกษาอื่น`,
      actor
    );

    return sourceEntries.length;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function createSchoolInvite(
  schoolId: string,
  email: string,
  role: 'school_admin' | 'scheduler' | 'teacher',
  teacherId: string,
  actor: ActorInfo
): Promise<SchoolInvite> {
  const inviteId = generateId('inv');
  const cleanEmail = email.trim().toLowerCase();
  const payload = stripUndefined({
    id: inviteId,
    schoolId,
    email: cleanEmail,
    role,
    teacherId: teacherId || undefined,
    status: 'pending' as const,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await setDoc(doc(db, 'schools', schoolId, 'invites', inviteId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `schools/${schoolId}/invites/${inviteId}`);
  }

  return {
    id: inviteId,
    schoolId,
    email: cleanEmail,
    role,
    teacherId: teacherId || undefined,
    status: 'pending',
    createdBy: actor.uid,
  };
}

export async function acceptSchoolInvite(
  schoolId: string,
  slug: string,
  inviteId: string,
  actor: ActorInfo
): Promise<void> {
  const inviteRef = doc(db, 'schools', schoolId, 'invites', inviteId);
  const memberRef = doc(db, 'schools', schoolId, 'members', actor.uid);
  const userRef = doc(db, 'users', actor.uid);

  try {
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) {
      throw new Error('ไม่พบคำเชิญเข้าร่วมโรงเรียนนี้');
    }
    const invite = inviteSnap.data() as SchoolInvite;
    if (invite.status !== 'pending') {
      throw new Error('คำเชิญนี้ถูกใช้งานหรือยกเลิกไปแล้ว');
    }
    if (invite.email.toLowerCase() !== actor.email.toLowerCase()) {
      throw new Error(`คำเชิญนี้ระบุสำหรับอีเมล ${invite.email} เท่านั้น`);
    }

    const batch = writeBatch(db);
    batch.update(inviteRef, {
      status: 'accepted',
      acceptedBy: actor.uid,
      updatedAt: serverTimestamp(),
    });
    batch.set(
      memberRef,
      stripUndefined({
        uid: actor.uid,
        email: actor.email,
        displayName: actor.displayName || actor.email,
        role: invite.role,
        status: 'active',
        teacherId: invite.teacherId || undefined,
        inviteId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    batch.update(userRef, {
      schoolId,
      schoolSlug: slug,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `schools/${schoolId}/invites/${inviteId}`);
  }
}

export type SchoolMasterCollections = {
  academicYears: AcademicYear[];
  departments: Department[];
  teachers: Teacher[];
  subjects: Subject[];
  classrooms: Classroom[];
  rooms: Room[];
  timeSlots: TimeSlot[];
  activities: ActivityLock[];
  timetables: TimetableEntry[];
  scheduleVersions: ScheduleVersion[];
  scheduleHistory: ScheduleHistory[];
  members: SchoolMember[];
  invites: SchoolInvite[];
  auditLogs: AuditLog[];
};
