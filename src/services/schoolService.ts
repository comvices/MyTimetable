import { apiFetch, emitWorkspaceUpdate } from '../lib/api';
import { sanitizeSlug } from '../lib/tenant';
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

export async function writeAuditLog(
  _schoolId: string,
  _actor: ActorInfo,
  _action: string,
  _targetType: string,
  _targetId = '',
  _details = ''
): Promise<void> {
  // Audit logging is automatically recorded server-side on API mutations
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
  _actor: ActorInfo
): Promise<{ schoolId: string; slug: string }> {
  const cleanSlug = sanitizeSlug(input.slug);
  if (cleanSlug.length < 2) {
    throw new Error('Subdomain ต้องมีตัวอักษรภาษาอังกฤษหรือตัวเลขอย่างน้อย 2 ตัวอักษร');
  }

  return await apiFetch<{ schoolId: string; slug: string }>('/api/schools', {
    method: 'POST',
    body: JSON.stringify({
      nameTh: input.nameTh,
      nameEn: input.nameEn || '',
      slug: cleanSlug,
      province: input.province || '',
      phone: input.phone || '',
      planId: input.planId,
    }),
  });
}

export async function uploadBrandingAsset(
  _schoolId: string,
  _assetName: 'logo' | 'login-cover' | 'background',
  blob: Blob
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ภาพได้'));
    reader.readAsDataURL(blob);
  });
}

export async function updateSchoolProfileAndBranding(
  school: School,
  updates: Partial<School>,
  _actor: ActorInfo
): Promise<void> {
  await apiFetch<{ school: School }>(`/api/schools/${encodeURIComponent(school.id)}/branding`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  emitWorkspaceUpdate(school.id);
}

export async function upsertSchoolDoc(
  schoolId: string,
  collectionName: string,
  docId: string,
  payload: Record<string, unknown>,
  _isNew: boolean
): Promise<void> {
  await apiFetch(
    `/api/schools/${encodeURIComponent(schoolId)}/collections/${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  );
  emitWorkspaceUpdate(schoolId);
}

export async function deleteSchoolDoc(
  schoolId: string,
  collectionName: string,
  docId: string
): Promise<void> {
  await apiFetch(
    `/api/schools/${encodeURIComponent(schoolId)}/collections/${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}`,
    {
      method: 'DELETE',
    }
  );
  emitWorkspaceUpdate(schoolId);
}

export async function activateSchoolAcademicYear(
  schoolId: string,
  yearId: string
): Promise<void> {
  await apiFetch(
    `/api/schools/${encodeURIComponent(schoolId)}/academic-years/${encodeURIComponent(yearId)}/activate`,
    {
      method: 'POST',
    }
  );
  emitWorkspaceUpdate(schoolId);
}

export async function syncSchoolTeacherCount(_schoolId: string, _count: number): Promise<void> {
  // Teacher count is maintained server-side on teachers collection mutations
}

export async function saveTimetableEntryTransaction(
  schoolId: string,
  entry: Omit<TimetableEntry, 'createdAt' | 'updatedAt'>,
  expectedRevision: number | null,
  _actor: ActorInfo
): Promise<void> {
  await apiFetch(`/api/schools/${encodeURIComponent(schoolId)}/timetables/save`, {
    method: 'POST',
    body: JSON.stringify({
      entry,
      expectedRevision,
    }),
  });
  emitWorkspaceUpdate(schoolId);
}

export async function recordScheduleHistory(
  schoolId: string,
  academicYearId: string,
  action: string,
  summary: string,
  _actor: ActorInfo
): Promise<void> {
  try {
    await apiFetch(`/api/schools/${encodeURIComponent(schoolId)}/history`, {
      method: 'POST',
      body: JSON.stringify({
        academicYearId,
        action,
        summary,
      }),
    });
    emitWorkspaceUpdate(schoolId);
  } catch (err) {
    console.warn('Schedule history write skipped:', err);
  }
}

export async function createScheduleVersionSnapshot(
  schoolId: string,
  academicYearId: string,
  name: string,
  entries: TimetableEntry[],
  _actor: ActorInfo
): Promise<void> {
  await apiFetch(`/api/schools/${encodeURIComponent(schoolId)}/versions`, {
    method: 'POST',
    body: JSON.stringify({
      academicYearId,
      name,
      entries: entries.slice(0, 800).map((e) => ({
        dayOfWeek: e.dayOfWeek,
        periodNumber: e.periodNumber,
        classroomId: e.classroomId,
        subjectId: e.subjectId,
        teacherId: e.teacherId,
        roomId: e.roomId || '',
      })),
    }),
  });
  emitWorkspaceUpdate(schoolId);
}

export async function restoreScheduleVersionSnapshot(
  schoolId: string,
  version: ScheduleVersion,
  _currentEntries: TimetableEntry[],
  _actor: ActorInfo
): Promise<void> {
  await apiFetch(
    `/api/schools/${encodeURIComponent(schoolId)}/versions/${encodeURIComponent(version.id)}/restore`,
    {
      method: 'POST',
    }
  );
  emitWorkspaceUpdate(schoolId);
}

export async function copyTimetableBetweenAcademicYears(
  schoolId: string,
  sourceAcademicYearId: string,
  targetAcademicYearId: string,
  _actor: ActorInfo
): Promise<number> {
  const res = await apiFetch<{ copiedCount: number }>(
    `/api/schools/${encodeURIComponent(schoolId)}/timetables/copy-year`,
    {
      method: 'POST',
      body: JSON.stringify({
        sourceAcademicYearId,
        targetAcademicYearId,
      }),
    }
  );
  emitWorkspaceUpdate(schoolId);
  return res.copiedCount || 0;
}

export async function createSchoolInvite(
  schoolId: string,
  email: string,
  role: 'school_admin' | 'scheduler' | 'teacher',
  teacherId: string,
  _actor: ActorInfo
): Promise<SchoolInvite> {
  const res = await apiFetch<{ invite: SchoolInvite }>(
    `/api/schools/${encodeURIComponent(schoolId)}/invites`,
    {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        role,
        teacherId: teacherId || '',
      }),
    }
  );
  emitWorkspaceUpdate(schoolId);
  return res.invite;
}

export async function acceptSchoolInvite(
  schoolId: string,
  _slug: string,
  inviteId: string,
  _actor: ActorInfo
): Promise<void> {
  await apiFetch(
    `/api/schools/${encodeURIComponent(schoolId)}/invites/${encodeURIComponent(inviteId)}/accept`,
    {
      method: 'POST',
    }
  );
  emitWorkspaceUpdate(schoolId);
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
