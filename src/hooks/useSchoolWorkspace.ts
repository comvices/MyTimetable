import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { apiFetch, subscribeWorkspaceEvents } from '../lib/api';
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

interface WorkspaceResponse {
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
}

export function useSchoolWorkspace(): SchoolWorkspaceData {
  const { authReady, currentUser } = useAuth();
  const { school } = useTenant();
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

  const fetchWorkspace = useCallback(async (schoolId: string) => {
    try {
      const data = await apiFetch<WorkspaceResponse>(
        `/api/schools/${encodeURIComponent(schoolId)}/workspace`
      );
      setAcademicYears(data.academicYears || []);
      setDepartments(data.departments || []);
      setTeachers(data.teachers || []);
      setSubjects(data.subjects || []);
      setClassrooms(data.classrooms || []);
      setRooms(data.rooms || []);
      setTimeSlots(
        [...(data.timeSlots || [])].sort((a, b) => a.periodNumber - b.periodNumber)
      );
      setActivities(data.activities || []);
      setTimetables(data.timetables || []);
      setScheduleVersions(
        [...(data.scheduleVersions || [])].sort(
          (a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)
        )
      );
      setScheduleHistory(
        [...(data.scheduleHistory || [])].sort(
          (a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)
        )
      );
      setMembers(data.members || []);
      setInvites(data.invites || []);
    } catch (err) {
      console.error('Failed to load school workspace:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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
    void fetchWorkspace(schoolId);
    const unsub = subscribeWorkspaceEvents(schoolId, () => {
      void fetchWorkspace(schoolId);
    });
    return () => unsub();
  }, [authReady, currentUser, school?.id, fetchWorkspace]);

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
