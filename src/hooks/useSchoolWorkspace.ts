import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { db } from '../lib/firebase';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';
import { SchoolInvite, SchoolMember } from '../types/saas';
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

export interface SchoolWorkspaceData {
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
  loading: boolean;
}

export function useSchoolWorkspace(): SchoolWorkspaceData {
  const { authReady, currentUser, isSuperAdmin } = useAuth();
  const { school, member } = useTenant();
  const [loading, setLoading] = useState(true);

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [activities, setActivities] = useState<ActivityLock[]>([]);
  const [timetables, setTimetables] = useState<TimetableEntry[]>([]);
  const [scheduleVersions, setScheduleVersions] = useState<ScheduleVersion[]>([]);
  const [scheduleHistory, setScheduleHistory] = useState<ScheduleHistory[]>([]);
  const [members, setMembers] = useState<SchoolMember[]>([]);
  const [invites, setInvites] = useState<SchoolInvite[]>([]);

  const canListInvites = isSuperAdmin || member?.role === 'school_admin';

  useEffect(() => {
    if (!authReady || !currentUser || !school?.id) {
      setAcademicYears([]);
      setDepartments([]);
      setTeachers([]);
      setSubjects([]);
      setClassrooms([]);
      setRooms([]);
      setTimeSlots([]);
      setActivities([]);
      setTimetables([]);
      setScheduleVersions([]);
      setScheduleHistory([]);
      setMembers([]);
      setInvites([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const schoolId = school.id;
    const unsubs: Array<() => void> = [];
    let settled = false;

    const markLoaded = () => {
      if (!settled) {
        settled = true;
        setLoading(false);
      }
    };

    const subscribeSubcollection = <T,>(
      subName: string,
      setter: (items: T[]) => void,
      transform?: (items: T[]) => T[]
    ) => {
      const path = `schools/${schoolId}/${subName}`;
      const unsub = onSnapshot(
        collection(db, 'schools', schoolId, subName),
        (snap) => {
          const raw = snap.docs.map((d) => d.data() as T);
          setter(transform ? transform(raw) : raw);
          markLoaded();
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, path);
        }
      );
      unsubs.push(unsub);
    };

    subscribeSubcollection<AcademicYear>('academicYears', setAcademicYears);
    subscribeSubcollection<Department>('departments', setDepartments);
    subscribeSubcollection<Teacher>('teachers', setTeachers);
    subscribeSubcollection<Subject>('subjects', setSubjects);
    subscribeSubcollection<Classroom>('classrooms', setClassrooms);
    subscribeSubcollection<Room>('rooms', setRooms);
    subscribeSubcollection<TimeSlot>('timeSlots', setTimeSlots, (items) =>
      [...items].sort((a, b) => a.periodNumber - b.periodNumber)
    );
    subscribeSubcollection<ActivityLock>('activities', setActivities);
    subscribeSubcollection<TimetableEntry>('timetables', setTimetables);
    subscribeSubcollection<ScheduleVersion>('scheduleVersions', setScheduleVersions, (items) =>
      [...items].sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
    );
    subscribeSubcollection<ScheduleHistory>('scheduleHistory', setScheduleHistory, (items) =>
      [...items].sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
    );
    subscribeSubcollection<SchoolMember>('members', setMembers);

    if (canListInvites) {
      subscribeSubcollection<SchoolInvite>('invites', setInvites);
    } else {
      setInvites([]);
    }

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [authReady, currentUser, school?.id, canListInvites]);

  return {
    academicYears,
    departments,
    teachers,
    subjects,
    classrooms,
    rooms,
    timeSlots,
    activities,
    timetables,
    scheduleVersions,
    scheduleHistory,
    members,
    invites,
    loading,
  };
}
