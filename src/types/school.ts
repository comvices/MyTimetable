import type { Timestamp } from 'firebase/firestore';

export interface AcademicYear {
  id: string;
  year: string;
  semester: string;
  isActive: boolean;
  daysOfWeek: number[]; // 1=Mon .. 5=Fri .. 7=Sun
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Department {
  id: string;
  code?: string;
  name: string;
  color: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Teacher {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  departmentId?: string;
  position?: string;
  maxHoursPerWeek: number;
  email?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  departmentId?: string;
  gradeLevel: string;
  credits: number;
  hoursPerWeek: number;
  defaultTeacherId?: string;
  color?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Classroom {
  id: string;
  name: string;
  gradeLevel: string;
  homeroomTeacherId?: string;
  studentCount?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  building?: string;
  floor?: string;
  roomType: string;
  capacity: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface TimeSlot {
  id: string;
  periodNumber: number;
  label: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type ActivityScope = 'whole_school' | 'grade_level' | 'classroom';

export interface ActivityLock {
  id: string;
  academicYearId: string;
  name: string;
  category: string;
  scope: ActivityScope;
  targetGradeLevel?: string;
  targetClassroomId?: string;
  dayOfWeek: number;
  periodNumber: number;
  venue?: string;
  roomId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface TimetableEntry {
  id: string;
  academicYearId: string;
  dayOfWeek: number;
  periodNumber: number;
  classroomId: string;
  subjectId: string;
  teacherId: string;
  roomId: string;
  revision: number;
  updatedBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ScheduleVersionEntrySnapshot {
  dayOfWeek: number;
  periodNumber: number;
  classroomId: string;
  subjectId: string;
  teacherId: string;
  roomId: string;
}

export interface ScheduleVersion {
  id: string;
  academicYearId: string;
  name: string;
  entryCount: number;
  entries: ScheduleVersionEntrySnapshot[];
  createdBy: string;
  createdAt?: Timestamp;
}

export interface ScheduleHistory {
  id: string;
  academicYearId: string;
  action: string;
  summary: string;
  actorUid: string;
  actorEmail?: string;
  createdAt?: Timestamp;
}

export type ConflictType = 'teacher' | 'room' | 'classroom' | 'activity_lock';

export interface ConflictDetail {
  id: string;
  type: ConflictType;
  dayOfWeek: number;
  periodNumber: number;
  entryIds: string[];
  title: string;
  description: string;
  suggestedSlots: Array<{ dayOfWeek: number; periodNumber: number }>;
  suggestedRooms: Array<{ id: string; name: string }>;
}

export const DAY_LABELS_TH: Record<number, string> = {
  1: 'จันทร์',
  2: 'อังคาร',
  3: 'พุธ',
  4: 'พฤหัสบดี',
  5: 'ศุกร์',
  6: 'เสาร์',
  7: 'อาทิตย์',
};

export const DAY_SHORT_TH: Record<number, string> = {
  1: 'จ.',
  2: 'อ.',
  3: 'พ.',
  4: 'พฤ.',
  5: 'ศ.',
  6: 'ส.',
  7: 'อา.',
};
