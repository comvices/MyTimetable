import { apiFetch, emitWorkspaceUpdate } from '../lib/api';
import { ActorInfo } from './schoolService';

export interface DemoSandboxResult {
  schoolId: string;
  slug: string;
  schoolName: string;
  teacherCount: number;
  subjectCount: number;
  classroomCount: number;
  roomCount: number;
  timetableCount: number;
  sampleUsers: Array<{
    uid: string;
    displayName: string;
    email: string;
    role: 'school_admin' | 'scheduler' | 'teacher';
    teacherId?: string;
    description: string;
  }>;
}

export async function seedSampleDataIntoExistingSchool(
  schoolId: string,
  _actor: ActorInfo,
  existingYearId?: string
): Promise<DemoSandboxResult> {
  const result = await apiFetch<DemoSandboxResult>(
    `/api/schools/${encodeURIComponent(schoolId)}/seed-demo`,
    {
      method: 'POST',
      body: JSON.stringify({ academicYearId: existingYearId || '' }),
    }
  );
  emitWorkspaceUpdate(schoolId);
  return result;
}

export async function createDemoSchoolAndSampleUsers(
  _actor: ActorInfo,
  options?: { slug?: string; nameTh?: string }
): Promise<DemoSandboxResult> {
  return await apiFetch<DemoSandboxResult>('/api/schools/demo', {
    method: 'POST',
    body: JSON.stringify({
      slug: options?.slug || 'demo-school',
      nameTh: options?.nameTh || '',
    }),
  });
}
