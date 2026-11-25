import {
  ActivityLock,
  Classroom,
  ConflictDetail,
  DAY_LABELS_TH,
  Room,
  Subject,
  Teacher,
  TimeSlot,
  TimetableEntry,
} from '../types/school';

export interface ConflictDetectionContext {
  entries: TimetableEntry[];
  activities: ActivityLock[];
  teachers: Teacher[];
  rooms: Room[];
  classrooms: Classroom[];
  subjects: Subject[];
  timeSlots: TimeSlot[];
  daysOfWeek: number[];
}

export function doesActivityApplyToClassroom(
  activity: ActivityLock,
  classroom: Classroom | undefined
): boolean {
  if (!classroom) return false;
  if (activity.scope === 'whole_school') return true;
  if (activity.scope === 'grade_level') {
    return activity.targetGradeLevel === classroom.gradeLevel;
  }
  if (activity.scope === 'classroom') {
    return activity.targetClassroomId === classroom.id;
  }
  return false;
}

export function isSlotBlockedByActivity(
  dayOfWeek: number,
  periodNumber: number,
  classroomId: string,
  roomId: string,
  activities: ActivityLock[],
  classrooms: Classroom[]
): ActivityLock | null {
  const classroom = classrooms.find((c) => c.id === classroomId);
  for (const act of activities) {
    if (act.dayOfWeek !== dayOfWeek || act.periodNumber !== periodNumber) continue;
    if (doesActivityApplyToClassroom(act, classroom)) return act;
    if (roomId && act.roomId && act.roomId === roomId) return act;
  }
  return null;
}

export function findFreeSuggestions(
  entry: TimetableEntry,
  ctx: ConflictDetectionContext
): {
  suggestedSlots: Array<{ dayOfWeek: number; periodNumber: number }>;
  suggestedRooms: Array<{ id: string; name: string }>;
} {
  const suggestedSlots: Array<{ dayOfWeek: number; periodNumber: number }> = [];
  const teachableSlots = ctx.timeSlots.filter((s) => !s.isBreak);

  for (const day of ctx.daysOfWeek) {
    for (const slot of teachableSlots) {
      if (day === entry.dayOfWeek && slot.periodNumber === entry.periodNumber) continue;
      const teacherBusy = ctx.entries.some(
        (e) =>
          e.id !== entry.id &&
          e.dayOfWeek === day &&
          e.periodNumber === slot.periodNumber &&
          e.teacherId === entry.teacherId
      );
      const classBusy = ctx.entries.some(
        (e) =>
          e.id !== entry.id &&
          e.dayOfWeek === day &&
          e.periodNumber === slot.periodNumber &&
          e.classroomId === entry.classroomId
      );
      const roomBusy =
        Boolean(entry.roomId) &&
        ctx.entries.some(
          (e) =>
            e.id !== entry.id &&
            e.dayOfWeek === day &&
            e.periodNumber === slot.periodNumber &&
            e.roomId === entry.roomId
        );
      const actBlocked = isSlotBlockedByActivity(
        day,
        slot.periodNumber,
        entry.classroomId,
        entry.roomId,
        ctx.activities,
        ctx.classrooms
      );

      if (!teacherBusy && !classBusy && !roomBusy && !actBlocked) {
        suggestedSlots.push({ dayOfWeek: day, periodNumber: slot.periodNumber });
        if (suggestedSlots.length >= 5) break;
      }
    }
    if (suggestedSlots.length >= 5) break;
  }

  const suggestedRooms: Array<{ id: string; name: string }> = [];
  for (const room of ctx.rooms) {
    if (room.id === entry.roomId) continue;
    const busyInEntries = ctx.entries.some(
      (e) =>
        e.id !== entry.id &&
        e.dayOfWeek === entry.dayOfWeek &&
        e.periodNumber === entry.periodNumber &&
        e.roomId === room.id
    );
    const busyInActivities = ctx.activities.some(
      (a) =>
        a.dayOfWeek === entry.dayOfWeek &&
        a.periodNumber === entry.periodNumber &&
        a.roomId === room.id
    );
    if (!busyInEntries && !busyInActivities) {
      suggestedRooms.push({ id: room.id, name: `${room.code} ${room.name}` });
      if (suggestedRooms.length >= 5) break;
    }
  }

  return { suggestedSlots, suggestedRooms };
}

export function detectTimetableConflicts(ctx: ConflictDetectionContext): ConflictDetail[] {
  const conflicts: ConflictDetail[] = [];
  const teacherMap = new Map(ctx.teachers.map((t) => [t.id, t]));
  const roomMap = new Map(ctx.rooms.map((r) => [r.id, r]));
  const classroomMap = new Map(ctx.classrooms.map((c) => [c.id, c]));
  const subjectMap = new Map(ctx.subjects.map((s) => [s.id, s]));

  // Group by (day, period)
  const slotGroups = new Map<string, TimetableEntry[]>();
  for (const entry of ctx.entries) {
    const key = `${entry.dayOfWeek}_${entry.periodNumber}`;
    const list = slotGroups.get(key) || [];
    list.push(entry);
    slotGroups.set(key, list);
  }

  for (const [, slotEntries] of slotGroups.entries()) {
    // 1. Teacher conflicts
    const byTeacher = new Map<string, TimetableEntry[]>();
    for (const e of slotEntries) {
      const arr = byTeacher.get(e.teacherId) || [];
      arr.push(e);
      byTeacher.set(e.teacherId, arr);
    }
    for (const [teacherId, group] of byTeacher.entries()) {
      if (group.length > 1) {
        const t = teacherMap.get(teacherId);
        const teacherName = t ? `${t.firstName} ${t.lastName}` : teacherId;
        const parties = group
          .map((e) => {
            const cls = classroomMap.get(e.classroomId)?.name || e.classroomId;
            const subj = subjectMap.get(e.subjectId)?.name || e.subjectId;
            return `${cls} (${subj})`;
          })
          .join(' และ ');
        const suggestions = findFreeSuggestions(group[0], ctx);
        conflicts.push({
          id: `teacher_${teacherId}_${group[0].dayOfWeek}_${group[0].periodNumber}`,
          type: 'teacher',
          dayOfWeek: group[0].dayOfWeek,
          periodNumber: group[0].periodNumber,
          entryIds: group.map((g) => g.id),
          title: `ครูสอนชนกัน: ${teacherName}`,
          description: `วัน${DAY_LABELS_TH[group[0].dayOfWeek]} คาบ ${group[0].periodNumber} — ${parties}`,
          ...suggestions,
        });
      }
    }

    // 2. Room conflicts
    const byRoom = new Map<string, TimetableEntry[]>();
    for (const e of slotEntries) {
      if (!e.roomId) continue;
      const arr = byRoom.get(e.roomId) || [];
      arr.push(e);
      byRoom.set(e.roomId, arr);
    }
    for (const [roomId, group] of byRoom.entries()) {
      if (group.length > 1) {
        const r = roomMap.get(roomId);
        const roomName = r ? `${r.code} (${r.name})` : roomId;
        const parties = group
          .map((e) => classroomMap.get(e.classroomId)?.name || e.classroomId)
          .join(' และ ');
        const suggestions = findFreeSuggestions(group[0], ctx);
        conflicts.push({
          id: `room_${roomId}_${group[0].dayOfWeek}_${group[0].periodNumber}`,
          type: 'room',
          dayOfWeek: group[0].dayOfWeek,
          periodNumber: group[0].periodNumber,
          entryIds: group.map((g) => g.id),
          title: `ห้องเรียนซ้ำซ้อน: ${roomName}`,
          description: `วัน${DAY_LABELS_TH[group[0].dayOfWeek]} คาบ ${group[0].periodNumber} — ชั้นเรียน ${parties}`,
          ...suggestions,
        });
      }
    }

    // 3. Classroom conflicts
    const byClass = new Map<string, TimetableEntry[]>();
    for (const e of slotEntries) {
      const arr = byClass.get(e.classroomId) || [];
      arr.push(e);
      byClass.set(e.classroomId, arr);
    }
    for (const [classroomId, group] of byClass.entries()) {
      if (group.length > 1) {
        const c = classroomMap.get(classroomId);
        const suggestions = findFreeSuggestions(group[0], ctx);
        conflicts.push({
          id: `class_${classroomId}_${group[0].dayOfWeek}_${group[0].periodNumber}`,
          type: 'classroom',
          dayOfWeek: group[0].dayOfWeek,
          periodNumber: group[0].periodNumber,
          entryIds: group.map((g) => g.id),
          title: `ตารางชั้นเรียนซ้ำซ้อน: ${c?.name || classroomId}`,
          description: `วัน${DAY_LABELS_TH[group[0].dayOfWeek]} คาบ ${group[0].periodNumber} มีรายวิชาซ้อนกัน ${group.length} วิชา`,
          ...suggestions,
        });
      }
    }

    // 4. Activity Lock conflicts
    for (const entry of slotEntries) {
      const blockingActivity = isSlotBlockedByActivity(
        entry.dayOfWeek,
        entry.periodNumber,
        entry.classroomId,
        entry.roomId,
        ctx.activities,
        ctx.classrooms
      );
      if (blockingActivity) {
        const cls = classroomMap.get(entry.classroomId)?.name || entry.classroomId;
        const suggestions = findFreeSuggestions(entry, ctx);
        conflicts.push({
          id: `act_${blockingActivity.id}_${entry.id}`,
          type: 'activity_lock',
          dayOfWeek: entry.dayOfWeek,
          periodNumber: entry.periodNumber,
          entryIds: [entry.id],
          title: `ชนคาบกิจกรรมล็อก: ${blockingActivity.name}`,
          description: `วัน${DAY_LABELS_TH[entry.dayOfWeek]} คาบ ${entry.periodNumber} — ${cls} ถูกล็อกไว้สำหรับกิจกรรม (${blockingActivity.venue || 'ไม่ระบุสถานที่'})`,
          ...suggestions,
        });
      }
    }
  }

  return conflicts;
}

export function checkCandidateSlotConflict(
  candidate: {
    id?: string;
    dayOfWeek: number;
    periodNumber: number;
    classroomId: string;
    teacherId: string;
    roomId: string;
  },
  ctx: ConflictDetectionContext
): string | null {
  const teacherConflict = ctx.entries.find(
    (e) =>
      e.id !== candidate.id &&
      e.dayOfWeek === candidate.dayOfWeek &&
      e.periodNumber === candidate.periodNumber &&
      e.teacherId === candidate.teacherId
  );
  if (teacherConflict) {
    const cls = ctx.classrooms.find((c) => c.id === teacherConflict.classroomId)?.name || '';
    return `ครูมีสอนซ้อนกับชั้น ${cls} ในคาบนี้`;
  }

  const classConflict = ctx.entries.find(
    (e) =>
      e.id !== candidate.id &&
      e.dayOfWeek === candidate.dayOfWeek &&
      e.periodNumber === candidate.periodNumber &&
      e.classroomId === candidate.classroomId
  );
  if (classConflict) {
    return 'ชั้นเรียนนี้มีวิชาอื่นลงตารางในคาบนี้แล้ว';
  }

  if (candidate.roomId) {
    const roomConflict = ctx.entries.find(
      (e) =>
        e.id !== candidate.id &&
        e.dayOfWeek === candidate.dayOfWeek &&
        e.periodNumber === candidate.periodNumber &&
        e.roomId === candidate.roomId
    );
    if (roomConflict) {
      const cls = ctx.classrooms.find((c) => c.id === roomConflict.classroomId)?.name || '';
      return `ห้องเรียนถูกใช้งานโดยชั้น ${cls} ในคาบนี้`;
    }
  }

  const act = isSlotBlockedByActivity(
    candidate.dayOfWeek,
    candidate.periodNumber,
    candidate.classroomId,
    candidate.roomId,
    ctx.activities,
    ctx.classrooms
  );
  if (act) {
    return `คาบนี้ถูกล็อกสำหรับกิจกรรม "${act.name}"`;
  }

  return null;
}

export function generateAutoScheduleDraft(
  academicYearId: string,
  actorUid: string,
  ctx: ConflictDetectionContext
): Omit<TimetableEntry, 'createdAt' | 'updatedAt'>[] {
  const placed: TimetableEntry[] = [...ctx.entries];
  const generated: Omit<TimetableEntry, 'createdAt' | 'updatedAt'>[] = [];
  const teachableSlots = ctx.timeSlots.filter((s) => !s.isBreak);

  for (const classroom of ctx.classrooms) {
    const gradeSubjects = ctx.subjects.filter((s) => s.gradeLevel === classroom.gradeLevel);
    for (const subject of gradeSubjects) {
      const teacherId = subject.defaultTeacherId || ctx.teachers[0]?.id;
      if (!teacherId) continue;

      const existingCount = placed.filter(
        (e) => e.classroomId === classroom.id && e.subjectId === subject.id
      ).length;
      const needed = Math.max(0, subject.hoursPerWeek - existingCount);

      let added = 0;
      for (const day of ctx.daysOfWeek) {
        if (added >= needed) break;
        // Spread across days where possible (max 2 periods same subject per day)
        const sameDayCount = placed.filter(
          (e) => e.classroomId === classroom.id && e.subjectId === subject.id && e.dayOfWeek === day
        ).length;
        if (sameDayCount >= 2) continue;

        for (const slot of teachableSlots) {
          if (added >= needed) break;

          // Pick first available room matching classroom capacity
          const availableRoom = ctx.rooms.find((room) => {
            if ((classroom.studentCount || 0) > room.capacity) return false;
            const conflict = checkCandidateSlotConflict(
              {
                dayOfWeek: day,
                periodNumber: slot.periodNumber,
                classroomId: classroom.id,
                teacherId,
                roomId: room.id,
              },
              { ...ctx, entries: placed }
            );
            return conflict === null;
          });

          const roomId = availableRoom?.id || '';
          const conflict = checkCandidateSlotConflict(
            {
              dayOfWeek: day,
              periodNumber: slot.periodNumber,
              classroomId: classroom.id,
              teacherId,
              roomId,
            },
            { ...ctx, entries: placed }
          );

          if (conflict === null && (roomId !== '' || ctx.rooms.length === 0)) {
            const newEntry: TimetableEntry = {
              id: `auto_${classroom.id}_${subject.id}_${day}_${slot.periodNumber}_${Date.now().toString(36)}`,
              academicYearId,
              dayOfWeek: day,
              periodNumber: slot.periodNumber,
              classroomId: classroom.id,
              subjectId: subject.id,
              teacherId,
              roomId,
              revision: 1,
              updatedBy: actorUid,
            };
            placed.push(newEntry);
            generated.push(newEntry);
            added++;
          }
        }
      }
    }
  }

  return generated;
}
