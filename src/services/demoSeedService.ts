import { Timestamp, doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';
import { generateId, sanitizeSlug } from '../lib/tenant';
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
  actor: ActorInfo,
  existingYearId?: string
): Promise<DemoSandboxResult> {
  const yearId = existingYearId || 'yr_demo_2568_1';
  const batch = writeBatch(db);

  if (!existingYearId) {
    batch.set(doc(db, 'schools', schoolId, 'academicYears', yearId), {
      id: yearId,
      year: '2568',
      semester: '1',
      isActive: true,
      daysOfWeek: [1, 2, 3, 4, 5],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const depts = [
    { id: 'dept_demo_sci', code: 'SCI', name: 'วิทยาศาสตร์และเทคโนโลยี', color: '#0ea5e9' },
    { id: 'dept_demo_math', code: 'MATH', name: 'คณิตศาสตร์', color: '#8b5cf6' },
    { id: 'dept_demo_lang', code: 'TH', name: 'ภาษาไทยและสังคมศึกษา', color: '#ec4899' },
  ];
  depts.forEach((d) => {
    batch.set(doc(db, 'schools', schoolId, 'departments', d.id), {
      ...d,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  const teachers = [
    {
      id: 'tch_demo_1',
      code: 'T001',
      firstName: 'สมชาย',
      lastName: 'ใจดี',
      departmentId: 'dept_demo_math',
      position: 'ครูชำนาญการพิเศษ (ผู้จัดตาราง)',
      maxHoursPerWeek: 20,
      email: 'somchai.demo@school.ac.th',
    },
    {
      id: 'tch_demo_2',
      code: 'T002',
      firstName: 'นภาพร',
      lastName: 'วิทยา',
      departmentId: 'dept_demo_sci',
      position: 'ครูชำนาญการ',
      maxHoursPerWeek: 20,
      email: 'napaporn.demo@school.ac.th',
    },
    {
      id: 'tch_demo_3',
      code: 'T003',
      firstName: 'กิตติพงษ์',
      lastName: 'อักษร',
      departmentId: 'dept_demo_lang',
      position: 'ครู คศ.1',
      maxHoursPerWeek: 18,
      email: 'kittipong.demo@school.ac.th',
    },
  ];
  teachers.forEach((t) => {
    batch.set(doc(db, 'schools', schoolId, 'teachers', t.id), {
      ...t,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  const subjects = [
    {
      id: 'sub_demo_1',
      code: 'ค21101',
      name: 'คณิตศาสตร์พื้นฐาน 1',
      departmentId: 'dept_demo_math',
      gradeLevel: 'ม.1',
      credits: 1.5,
      hoursPerWeek: 4,
      defaultTeacherId: 'tch_demo_1',
      color: '#ddd6fe',
    },
    {
      id: 'sub_demo_2',
      code: 'ว21101',
      name: 'วิทยาศาสตร์พื้นฐาน 1',
      departmentId: 'dept_demo_sci',
      gradeLevel: 'ม.1',
      credits: 1.5,
      hoursPerWeek: 4,
      defaultTeacherId: 'tch_demo_2',
      color: '#bae6fd',
    },
    {
      id: 'sub_demo_3',
      code: 'ท21101',
      name: 'ภาษาไทยพื้นฐาน 1',
      departmentId: 'dept_demo_lang',
      gradeLevel: 'ม.1',
      credits: 1.5,
      hoursPerWeek: 3,
      defaultTeacherId: 'tch_demo_3',
      color: '#fbcfe8',
    },
  ];
  subjects.forEach((s) => {
    batch.set(doc(db, 'schools', schoolId, 'subjects', s.id), {
      ...s,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  const classrooms = [
    {
      id: 'cls_demo_1',
      name: 'ม.1/1',
      gradeLevel: 'ม.1',
      homeroomTeacherId: 'tch_demo_1',
      studentCount: 36,
    },
    {
      id: 'cls_demo_2',
      name: 'ม.1/2',
      gradeLevel: 'ม.1',
      homeroomTeacherId: 'tch_demo_2',
      studentCount: 35,
    },
  ];
  classrooms.forEach((c) => {
    batch.set(doc(db, 'schools', schoolId, 'classrooms', c.id), {
      ...c,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  const rooms = [
    {
      id: 'rm_demo_101',
      code: '101',
      name: 'ห้องเรียน 101',
      building: 'อาคาร 1',
      floor: '1',
      roomType: 'ห้องเรียนปกติ',
      capacity: 40,
    },
    {
      id: 'rm_demo_lab1',
      code: 'LAB1',
      name: 'ห้องปฏิบัติการวิทย์ 1',
      building: 'อาคาร 2',
      floor: '2',
      roomType: 'ห้องปฏิบัติการ',
      capacity: 40,
    },
    {
      id: 'rm_demo_102',
      code: '102',
      name: 'ห้องเรียน 102',
      building: 'อาคาร 1',
      floor: '1',
      roomType: 'ห้องเรียนปกติ',
      capacity: 40,
    },
  ];
  rooms.forEach((r) => {
    batch.set(doc(db, 'schools', schoolId, 'rooms', r.id), {
      ...r,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  const slots = [
    { id: 'slot_demo_1', periodNumber: 1, label: 'คาบ 1', startTime: '08:30', endTime: '09:20', isBreak: false },
    { id: 'slot_demo_2', periodNumber: 2, label: 'คาบ 2', startTime: '09:20', endTime: '10:10', isBreak: false },
    { id: 'slot_demo_3', periodNumber: 3, label: 'คาบ 3', startTime: '10:20', endTime: '11:10', isBreak: false },
    { id: 'slot_demo_4', periodNumber: 4, label: 'คาบ 4', startTime: '11:10', endTime: '12:00', isBreak: false },
    { id: 'slot_demo_5', periodNumber: 5, label: 'พักกลางวัน', startTime: '12:00', endTime: '13:00', isBreak: true },
    { id: 'slot_demo_6', periodNumber: 6, label: 'คาบ 5', startTime: '13:00', endTime: '13:50', isBreak: false },
    { id: 'slot_demo_7', periodNumber: 7, label: 'คาบ 6', startTime: '13:50', endTime: '14:40', isBreak: false },
  ];
  slots.forEach((sl) => {
    batch.set(doc(db, 'schools', schoolId, 'timeSlots', sl.id), {
      ...sl,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  batch.set(doc(db, 'schools', schoolId, 'activities', 'act_demo_scout'), {
    id: 'act_demo_scout',
    academicYearId: yearId,
    name: 'ลูกเสือ - เนตรนารี',
    category: 'กิจกรรมพัฒนาผู้เรียน',
    scope: 'whole_school',
    dayOfWeek: 3,
    periodNumber: 7,
    venue: 'สนามโรงเรียน',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const entries = [
    { id: 'tt_demo_1', dayOfWeek: 1, periodNumber: 1, classroomId: 'cls_demo_1', subjectId: 'sub_demo_1', teacherId: 'tch_demo_1', roomId: 'rm_demo_101' },
    { id: 'tt_demo_2', dayOfWeek: 1, periodNumber: 2, classroomId: 'cls_demo_1', subjectId: 'sub_demo_2', teacherId: 'tch_demo_2', roomId: 'rm_demo_lab1' },
    { id: 'tt_demo_3', dayOfWeek: 1, periodNumber: 3, classroomId: 'cls_demo_1', subjectId: 'sub_demo_3', teacherId: 'tch_demo_3', roomId: 'rm_demo_101' },
    { id: 'tt_demo_4', dayOfWeek: 1, periodNumber: 1, classroomId: 'cls_demo_2', subjectId: 'sub_demo_2', teacherId: 'tch_demo_2', roomId: 'rm_demo_lab1' },
    { id: 'tt_demo_5', dayOfWeek: 1, periodNumber: 2, classroomId: 'cls_demo_2', subjectId: 'sub_demo_1', teacherId: 'tch_demo_1', roomId: 'rm_demo_102' },
    { id: 'tt_demo_6', dayOfWeek: 2, periodNumber: 1, classroomId: 'cls_demo_1', subjectId: 'sub_demo_1', teacherId: 'tch_demo_1', roomId: 'rm_demo_101' },
  ];
  entries.forEach((e) => {
    batch.set(doc(db, 'schools', schoolId, 'timetables', e.id), {
      ...e,
      academicYearId: yearId,
      revision: 1,
      updatedBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  const histId = generateId('hist');
  batch.set(doc(db, 'schools', schoolId, 'scheduleHistory', histId), {
    id: histId,
    academicYearId: yearId,
    action: 'DEMO_SEED',
    summary: 'สร้างข้อมูลตัวอย่างครู วิชา ห้องเรียน และตารางสอนเริ่มต้น',
    actorUid: actor.uid,
    actorEmail: (actor.email || '').slice(0, 200),
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `schools/${schoolId}`);
  }

  return {
    schoolId,
    slug: '',
    schoolName: '',
    teacherCount: teachers.length,
    subjectCount: subjects.length,
    classroomCount: classrooms.length,
    roomCount: rooms.length,
    timetableCount: entries.length,
    sampleUsers: [
      {
        uid: 'tch_demo_1',
        displayName: 'อ.สมชาย ใจดี',
        email: 'somchai.demo@school.ac.th',
        role: 'scheduler',
        teacherId: 'tch_demo_1',
        description: 'ผู้จัดตารางสอน — ทดลองจัดตาราง Drag & Drop และล็อกกิจกรรมได้',
      },
      {
        uid: 'tch_demo_2',
        displayName: 'อ.นภาพร วิทยา',
        email: 'napaporn.demo@school.ac.th',
        role: 'teacher',
        teacherId: 'tch_demo_2',
        description: 'ครูผู้สอน — ทดลองดูตารางสอนรายบุคคลและส่งออก PDF/Excel',
      },
    ],
  };
}

export async function createDemoSchoolAndSampleUsers(
  actor: ActorInfo,
  options?: { slug?: string; nameTh?: string }
): Promise<DemoSandboxResult> {
  const baseSlug = sanitizeSlug(options?.slug || 'demo-school');
  let slug = baseSlug;
  const check = await getDoc(doc(db, 'schoolSlugs', slug));
  if (check.exists()) {
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const schoolId = generateId('schdemo');
  const subId = generateId('sub');
  const schoolName = options?.nameTh?.trim() || 'โรงเรียนสาธิตทดลองระบบ';
  const periodEnd = Timestamp.fromDate(new Date(Date.now() + 365 * 86400000));

  const batch = writeBatch(db);
  batch.set(doc(db, 'schools', schoolId), {
    id: schoolId,
    slug,
    ownerUid: actor.uid,
    nameTh: schoolName,
    nameEn: 'Demo Timetable School',
    province: 'กรุงเทพมหานคร',
    email: actor.email || '',
    primaryColor: '#0f3d75',
    secondaryColor: '#1e6fb8',
    welcomeMessage: 'โรงเรียนตัวอย่างสำหรับทดลองจัดตารางสอนและตรวจสอบสิทธิ์ผู้ใช้',
    planId: 'premium',
    subscriptionStatus: 'active',
    currentPeriodEnd: periodEnd,
    teacherCount: 3,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'schoolSlugs', slug), {
    slug,
    schoolId,
    ownerUid: actor.uid,
    nameTh: schoolName,
    nameEn: 'Demo Timetable School',
    primaryColor: '#0f3d75',
    secondaryColor: '#1e6fb8',
    welcomeMessage: 'โรงเรียนตัวอย่างสำหรับทดลองจัดตารางสอนและตรวจสอบสิทธิ์ผู้ใช้',
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'schools', schoolId, 'members', actor.uid), {
    uid: actor.uid,
    email: actor.email || '',
    displayName: actor.displayName || actor.email || 'ผู้ดูแลโรงเรียน',
    role: 'school_admin',
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'subscriptions', subId), {
    id: subId,
    schoolId,
    ownerUid: actor.uid,
    planId: 'premium',
    status: 'active',
    currentPeriodStart: serverTimestamp(),
    currentPeriodEnd: periodEnd,
    autoRenew: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `schools/${schoolId}`);
  }

  const seeded = await seedSampleDataIntoExistingSchool(schoolId, actor);
  return {
    ...seeded,
    slug,
    schoolName,
  };
}
