import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertTriangle,
  Copy,
  History,
  Lock,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { WorkspaceShell } from '../components/layout/WorkspaceShell';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useSchoolWorkspace } from '../hooks/useSchoolWorkspace';
import { formatErrorMessage } from '../lib/firestoreError';
import { generateId } from '../lib/tenant';
import {
  checkCandidateSlotConflict,
  detectTimetableConflicts,
  doesActivityApplyToClassroom,
  generateAutoScheduleDraft,
} from '../services/conflictService';
import {
  copyTimetableBetweenAcademicYears,
  createScheduleVersionSnapshot,
  deleteSchoolDoc,
  recordScheduleHistory,
  restoreScheduleVersionSnapshot,
  saveTimetableEntryTransaction,
} from '../services/schoolService';
import { seedSampleDataIntoExistingSchool } from '../services/demoSeedService';
import { DAY_LABELS_TH, TimetableEntry } from '../types/school';

interface UndoAction {
  type: 'move' | 'upsert' | 'delete';
  entry: Omit<TimetableEntry, 'createdAt' | 'updatedAt'>;
  previousState?: Omit<TimetableEntry, 'createdAt' | 'updatedAt'>;
}

const PASTEL_SUBJECT_FALLBACKS = [
  '#4A7BD0',
  '#2E8B71',
  '#7858C4',
  '#C95D75',
  '#B57428',
  '#3A8A9C',
];

function DraggableLessonCard({
  entry,
  subjectLabel,
  teacherLabel,
  roomLabel,
  accentColor,
  hasConflict,
  disabled,
  onClick,
}: {
  entry: TimetableEntry;
  subjectLabel: string;
  teacherLabel: string;
  roomLabel: string;
  accentColor: string;
  hasConflict: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.id,
    disabled,
    data: { entry },
  });

  const dragTransform = transform ? CSS.Translate.toString(transform) : undefined;
  const cardStyle: React.CSSProperties = {
    ...(dragTransform ? { transform: dragTransform, zIndex: isDragging ? 40 : undefined } : {}),
    ...(!hasConflict
      ? {
          backgroundColor: `${accentColor}16`,
          borderColor: `${accentColor}4D`,
        }
      : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={cardStyle}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`p-2 rounded-xl border text-left transition-all select-none ${
        disabled ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } ${
        hasConflict
          ? 'bg-rose-50 border-rose-500 text-rose-950'
          : 'hover:shadow-sm text-slate-900'
      } ${isDragging ? 'opacity-75 shadow-lg' : ''}`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {!hasConflict && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: accentColor }}
            />
          )}
          <div className="font-bold text-xs leading-snug truncate">{subjectLabel}</div>
        </div>
        {hasConflict && <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
      </div>
      <div className="text-[11px] text-slate-600 mt-0.5 truncate">{teacherLabel}</div>
      <div className="text-[11px] text-slate-500 font-mono truncate">{roomLabel || 'ไม่ระบุห้อง'}</div>
    </div>
  );
}

function DroppableSlotCell({
  id,
  children,
  onClick,
  isBlocked,
}: {
  id: string;
  children: React.ReactNode;
  onClick: () => void;
  isBlocked: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <td
      ref={setNodeRef}
      onClick={onClick}
      className={`p-1.5 align-top border-r border-slate-200 last:border-r-0 min-h-[76px] transition-colors cursor-pointer ${
        isOver ? 'bg-sky-50' : isBlocked ? 'bg-amber-50/40' : 'hover:bg-slate-50'
      }`}
    >
      {children}
    </td>
  );
}

export function TimetableEditorPage() {
  const { currentUser } = useAuth();
  const { school, effectiveSchoolRole, hasFeature, isReadOnly } = useTenant();
  const { theme } = useTheme();
  const { showToast, confirmAction } = useToast();
  const data = useSchoolWorkspace();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoAction[]>([]);
  const [saving, setSaving] = useState(false);

  // Edit/Create Lesson Modal
  const [lessonModal, setLessonModal] = useState<{
    mode: 'create' | 'edit';
    dayOfWeek: number;
    periodNumber: number;
    entry?: TimetableEntry;
  } | null>(null);
  const [lessonForm, setLessonForm] = useState({
    subjectId: '',
    teacherId: '',
    roomId: '',
  });

  // Side drawer modals: Versions / History / Copy Term
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [versionName, setVersionName] = useState('');
  const [copySourceYearId, setCopySourceYearId] = useState('');

  const activeYear = useMemo(
    () =>
      data.academicYears.find((y) => y.id === selectedYearId) ||
      data.academicYears.find((y) => y.isActive) ||
      data.academicYears[0],
    [data.academicYears, selectedYearId]
  );

  const activeClassroom = useMemo(
    () =>
      data.classrooms.find((c) => c.id === selectedClassroomId) || data.classrooms[0],
    [data.classrooms, selectedClassroomId]
  );

  const canEdit = !isReadOnly && effectiveSchoolRole !== 'teacher';
  const days = activeYear?.daysOfWeek || [1, 2, 3, 4, 5];
  const slots = useMemo(
    () => [...data.timeSlots].sort((a, b) => a.periodNumber - b.periodNumber),
    [data.timeSlots]
  );

  const yearEntries = useMemo(
    () =>
      activeYear
        ? data.timetables.filter((e) => e.academicYearId === activeYear.id)
        : data.timetables,
    [data.timetables, activeYear]
  );

  const yearActivities = useMemo(
    () =>
      activeYear
        ? data.activities.filter((a) => a.academicYearId === activeYear.id)
        : data.activities,
    [data.activities, activeYear]
  );

  const conflictContext = useMemo(
    () => ({
      entries: yearEntries,
      activities: yearActivities,
      teachers: data.teachers,
      rooms: data.rooms,
      classrooms: data.classrooms,
      subjects: data.subjects,
      timeSlots: data.timeSlots,
      daysOfWeek: days,
    }),
    [yearEntries, yearActivities, data, days]
  );

  const conflicts = useMemo(
    () => (hasFeature('conflict_detection') ? detectTimetableConflicts(conflictContext) : []),
    [conflictContext, hasFeature]
  );

  const conflictedEntryIds = useMemo(() => {
    const ids = new Set<string>();
    conflicts.forEach((c) => c.entryIds.forEach((id) => ids.add(id)));
    return ids;
  }, [conflicts]);

  const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));
  const teacherMap = new Map(data.teachers.map((t) => [t.id, t]));
  const roomMap = new Map(data.rooms.map((r) => [r.id, r]));

  const actor = {
    uid: currentUser?.uid || '',
    email: currentUser?.email || '',
    displayName: currentUser?.displayName || currentUser?.username || 'ผู้จัดตาราง',
  };

  const openCellModal = (dayOfWeek: number, periodNumber: number, entry?: TimetableEntry) => {
    if (!canEdit && !entry) return;
    if (entry) {
      setLessonForm({
        subjectId: entry.subjectId,
        teacherId: entry.teacherId,
        roomId: entry.roomId || '',
      });
      setLessonModal({ mode: 'edit', dayOfWeek, periodNumber, entry });
    } else {
      const defaultSubj = data.subjects.find((s) => s.gradeLevel === activeClassroom?.gradeLevel) || data.subjects[0];
      setLessonForm({
        subjectId: defaultSubj?.id || '',
        teacherId: defaultSubj?.defaultTeacherId || data.teachers[0]?.id || '',
        roomId: data.rooms[0]?.id || '',
      });
      setLessonModal({ mode: 'create', dayOfWeek, periodNumber });
    }
  };

  const liveCandidateWarning = useMemo(() => {
    if (!lessonModal || !activeClassroom || !lessonForm.teacherId) return null;
    return checkCandidateSlotConflict(
      {
        id: lessonModal.entry?.id,
        dayOfWeek: lessonModal.dayOfWeek,
        periodNumber: lessonModal.periodNumber,
        classroomId: activeClassroom.id,
        teacherId: lessonForm.teacherId,
        roomId: lessonForm.roomId,
      },
      conflictContext
    );
  }, [lessonModal, activeClassroom, lessonForm, conflictContext]);

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school || !activeYear || !activeClassroom || !lessonModal || !canEdit) return;
    if (!lessonForm.subjectId || !lessonForm.teacherId) {
      showToast('กรุณาเลือกรายวิชาและครูผู้สอน', 'warning');
      return;
    }

    if (liveCandidateWarning) {
      const proceed = await confirmAction({
        title: 'พบตารางชนกันในคาบนี้',
        description: `${liveCandidateWarning} — ต้องการบันทึกและให้ระบบแสดงแจ้งเตือนสีแดงเพื่อแก้ไขภายหลังหรือไม่?`,
        confirmLabel: 'บันทึกแบบมีคำเตือน',
      });
      if (!proceed) return;
    }

    setSaving(true);
    try {
      const id = lessonModal.entry?.id || generateId('tt');
      const payload: Omit<TimetableEntry, 'createdAt' | 'updatedAt'> = {
        id,
        academicYearId: activeYear.id,
        dayOfWeek: lessonModal.dayOfWeek,
        periodNumber: lessonModal.periodNumber,
        classroomId: activeClassroom.id,
        subjectId: lessonForm.subjectId,
        teacherId: lessonForm.teacherId,
        roomId: lessonForm.roomId,
        revision: lessonModal.entry?.revision || 1,
        updatedBy: actor.uid,
      };

      await saveTimetableEntryTransaction(
        school.id,
        payload,
        lessonModal.entry ? lessonModal.entry.revision : null,
        actor
      );

      setUndoStack((prev) => [
        ...prev,
        {
          type: 'upsert',
          entry: payload,
          previousState: lessonModal.entry
            ? {
                id: lessonModal.entry.id,
                academicYearId: lessonModal.entry.academicYearId,
                dayOfWeek: lessonModal.entry.dayOfWeek,
                periodNumber: lessonModal.entry.periodNumber,
                classroomId: lessonModal.entry.classroomId,
                subjectId: lessonModal.entry.subjectId,
                teacherId: lessonModal.entry.teacherId,
                roomId: lessonModal.entry.roomId,
                revision: lessonModal.entry.revision,
                updatedBy: lessonModal.entry.updatedBy,
              }
            : undefined,
        },
      ]);
      setRedoStack([]);
      await recordScheduleHistory(
        school.id,
        activeYear.id,
        lessonModal.mode === 'create' ? 'ADD_LESSON' : 'UPDATE_LESSON',
        `ชั้น ${activeClassroom.name} วัน${DAY_LABELS_TH[lessonModal.dayOfWeek]} คาบ ${lessonModal.periodNumber}`,
        actor
      );
      setLessonModal(null);
      showToast('บันทึกคาบเรียนเรียบร้อยแล้ว', 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLesson = async () => {
    if (!school || !activeYear || !lessonModal?.entry || !canEdit) return;
    setSaving(true);
    try {
      const removed = lessonModal.entry;
      await deleteSchoolDoc(school.id, 'timetables', removed.id);
      setUndoStack((prev) => [
        ...prev,
        {
          type: 'delete',
          entry: {
            id: removed.id,
            academicYearId: removed.academicYearId,
            dayOfWeek: removed.dayOfWeek,
            periodNumber: removed.periodNumber,
            classroomId: removed.classroomId,
            subjectId: removed.subjectId,
            teacherId: removed.teacherId,
            roomId: removed.roomId,
            revision: removed.revision,
            updatedBy: removed.updatedBy,
          },
        },
      ]);
      await recordScheduleHistory(
        school.id,
        activeYear.id,
        'DELETE_LESSON',
        `ลบคาบเรียนวัน${DAY_LABELS_TH[removed.dayOfWeek]} คาบ ${removed.periodNumber}`,
        actor
      );
      setLessonModal(null);
      showToast('ลบคาบเรียนออกจากตารางแล้ว', 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!canEdit || !school || !activeYear || !activeClassroom) return;
    const { active, over } = event;
    if (!over) return;

    const overId = String(over.id);
    if (!overId.startsWith('cell_')) return;
    const [, dayStr, periodStr] = overId.split('_');
    const targetDay = Number(dayStr);
    const targetPeriod = Number(periodStr);

    const dragged = yearEntries.find((e) => e.id === String(active.id));
    if (!dragged) return;
    if (dragged.dayOfWeek === targetDay && dragged.periodNumber === targetPeriod) return;

    const conflictMsg = checkCandidateSlotConflict(
      {
        id: dragged.id,
        dayOfWeek: targetDay,
        periodNumber: targetPeriod,
        classroomId: dragged.classroomId,
        teacherId: dragged.teacherId,
        roomId: dragged.roomId,
      },
      conflictContext
    );

    if (conflictMsg) {
      showToast(`ย้ายคาบไม่ได้: ${conflictMsg}`, 'warning');
      return;
    }

    const previousState: Omit<TimetableEntry, 'createdAt' | 'updatedAt'> = {
      id: dragged.id,
      academicYearId: dragged.academicYearId,
      dayOfWeek: dragged.dayOfWeek,
      periodNumber: dragged.periodNumber,
      classroomId: dragged.classroomId,
      subjectId: dragged.subjectId,
      teacherId: dragged.teacherId,
      roomId: dragged.roomId,
      revision: dragged.revision,
      updatedBy: dragged.updatedBy,
    };

    const nextState: Omit<TimetableEntry, 'createdAt' | 'updatedAt'> = {
      ...previousState,
      dayOfWeek: targetDay,
      periodNumber: targetPeriod,
      updatedBy: actor.uid,
    };

    try {
      await saveTimetableEntryTransaction(school.id, nextState, dragged.revision, actor);
      setUndoStack((prev) => [...prev, { type: 'move', entry: nextState, previousState }]);
      setRedoStack([]);
      await recordScheduleHistory(
        school.id,
        activeYear.id,
        'MOVE_LESSON',
        `ย้ายวิชาจากวัน${DAY_LABELS_TH[dragged.dayOfWeek]} คาบ ${dragged.periodNumber} ไปวัน${DAY_LABELS_TH[targetDay]} คาบ ${targetPeriod}`,
        actor
      );
      showToast('ย้ายคาบสอนสำเร็จ', 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    }
  };

  const handleUndo = async () => {
    if (!school || !canEdit || undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    try {
      if (action.type === 'delete') {
        await saveTimetableEntryTransaction(school.id, action.entry, null, actor);
      } else if (action.previousState) {
        await saveTimetableEntryTransaction(school.id, action.previousState, null, actor);
      } else {
        await deleteSchoolDoc(school.id, 'timetables', action.entry.id);
      }
      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev, action]);
      showToast('ย้อนกลับการแก้ไขล่าสุดแล้ว (Undo)', 'info');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    }
  };

  const handleRedo = async () => {
    if (!school || !canEdit || redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    try {
      if (action.type === 'delete') {
        await deleteSchoolDoc(school.id, 'timetables', action.entry.id);
      } else {
        await saveTimetableEntryTransaction(school.id, action.entry, null, actor);
      }
      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => [...prev, action]);
      showToast('ทำซ้ำการแก้ไขแล้ว (Redo)', 'info');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    }
  };

  const handleAutoSchedule = async () => {
    if (!school || !activeYear || !canEdit) return;
    if (!hasFeature('auto_scheduling')) {
      showToast('Auto Scheduling พร้อมใช้งานในแพ็กเกจ Premium', 'warning');
      return;
    }
    const generated = generateAutoScheduleDraft(activeYear.id, actor.uid, conflictContext);
    if (generated.length === 0) {
      showToast('ไม่พบชั่วโมงสอนที่ยังขาด หรือไม่สามารถจัดลงช่องว่างที่เหลือได้', 'info');
      return;
    }
    setSaving(true);
    try {
      for (const item of generated) {
        await saveTimetableEntryTransaction(school.id, item, null, actor);
      }
      await recordScheduleHistory(
        school.id,
        activeYear.id,
        'AUTO_SCHEDULE',
        `จัดตารางอัตโนมัติเพิ่มเติม ${generated.length} คาบ`,
        actor
      );
      showToast(`จัดตารางอัตโนมัติสำเร็จ ${generated.length} คาบ`, 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveConflictEntry = async (
    entryId: string,
    targetDay: number,
    targetPeriod: number
  ) => {
    if (!school || !activeYear || !canEdit) return;
    const entry = yearEntries.find((e) => e.id === entryId);
    if (!entry) return;
    try {
      await saveTimetableEntryTransaction(
        school.id,
        {
          id: entry.id,
          academicYearId: entry.academicYearId,
          dayOfWeek: targetDay,
          periodNumber: targetPeriod,
          classroomId: entry.classroomId,
          subjectId: entry.subjectId,
          teacherId: entry.teacherId,
          roomId: entry.roomId,
          revision: entry.revision,
          updatedBy: actor.uid,
        },
        entry.revision,
        actor
      );
      await recordScheduleHistory(
        school.id,
        activeYear.id,
        'RESOLVE_CONFLICT_MOVE',
        `ย้ายคาบชนไปวัน${DAY_LABELS_TH[targetDay]} คาบ ${targetPeriod}`,
        actor
      );
      showToast(`ย้ายไปวัน${DAY_LABELS_TH[targetDay]} คาบ ${targetPeriod} แล้ว`, 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    }
  };

  const handleChangeConflictRoom = async (entryId: string, roomId: string) => {
    if (!school || !activeYear || !canEdit) return;
    const entry = yearEntries.find((e) => e.id === entryId);
    if (!entry) return;
    try {
      await saveTimetableEntryTransaction(
        school.id,
        {
          id: entry.id,
          academicYearId: entry.academicYearId,
          dayOfWeek: entry.dayOfWeek,
          periodNumber: entry.periodNumber,
          classroomId: entry.classroomId,
          subjectId: entry.subjectId,
          teacherId: entry.teacherId,
          roomId,
          revision: entry.revision,
          updatedBy: actor.uid,
        },
        entry.revision,
        actor
      );
      const nextRoom = roomMap.get(roomId);
      await recordScheduleHistory(
        school.id,
        activeYear.id,
        'RESOLVE_CONFLICT_ROOM',
        `เปลี่ยนห้องเรียนคาบชนเป็น ${nextRoom ? `${nextRoom.code} ${nextRoom.name}` : roomId}`,
        actor
      );
      showToast('เปลี่ยนห้องเรียนเรียบร้อยแล้ว', 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    }
  };

  return (
    <WorkspaceShell
      title="ระบบจัดตารางสอนรายสัปดาห์"
      breadcrumb={
        activeClassroom
          ? `${activeClassroom.name} · ปีการศึกษา ${activeYear?.year || '-'}/${activeYear?.semester || '-'}`
          : school?.nameTh
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => void handleUndo()}
                disabled={undoStack.length === 0}
                className="inline-flex items-center gap-1 px-2.5 py-2 border border-slate-300 bg-white rounded-lg text-xs font-medium text-slate-700 disabled:opacity-40"
                title="Undo"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Undo</span>
              </button>
              <button
                type="button"
                onClick={() => void handleRedo()}
                disabled={redoStack.length === 0}
                className="inline-flex items-center gap-1 px-2.5 py-2 border border-slate-300 bg-white rounded-lg text-xs font-medium text-slate-700 disabled:opacity-40"
                title="Redo"
              >
                <Redo2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Redo</span>
              </button>
              <button
                type="button"
                onClick={() => void handleAutoSchedule()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-white text-xs font-semibold rounded-xl shadow-xs hover:opacity-95 whitespace-nowrap"
                style={{
                  background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>จัดตารางอัตโนมัติ</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setVersionModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 rounded-lg whitespace-nowrap"
          >
            <History className="w-3.5 h-3.5" />
            <span>เวอร์ชัน & ประวัติ</span>
          </button>
        </div>
      }
    >
      {/* Controls Bar */}
      <div
        className="pastel-glass border rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4"
        style={{ borderColor: theme.border }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">ปีการศึกษา / ภาคเรียน</label>
            <select
              value={activeYear?.id || ''}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="px-3 py-2 rounded-xl border text-sm bg-white"
              style={{ borderColor: theme.border }}
            >
              {data.academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  ปี {ay.year} ภาค {ay.semester}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">เลือกชั้นเรียน</label>
            <select
              value={activeClassroom?.id || ''}
              onChange={(e) => setSelectedClassroomId(e.target.value)}
              className="px-3 py-2 rounded-xl border text-sm bg-white font-semibold"
              style={{ borderColor: theme.border }}
            >
              {data.classrooms.length === 0 && <option value="">ยังไม่มีชั้นเรียน</option>}
              {data.classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.gradeLevel})
                </option>
              ))}
            </select>
          </div>

          {activeClassroom && (
            <div className="self-end pb-0.5">
              <span
                className="inline-flex items-center px-3 py-2 rounded-xl border text-xs font-semibold tabular-nums"
                style={{
                  backgroundColor: theme.pastelSoft,
                  borderColor: theme.border,
                  color: theme.primary,
                }}
              >
                จัดแล้ว {yearEntries.filter((e) => e.classroomId === activeClassroom.id).length} คาบ/สัปดาห์
              </span>
            </div>
          )}
        </div>

        <div className="text-xs text-slate-500">
          {canEdit
            ? 'ลากและวางการ์ดวิชาเพื่อย้ายคาบ · คลิกช่องว่างเพื่อเพิ่มรายวิชา'
            : 'โหมดดูข้อมูล (ไม่สามารถแก้ไข)'}
        </div>
      </div>

      {!activeClassroom ? (
        <div
          className="pastel-glass border rounded-2xl p-10 text-center text-sm text-slate-500"
          style={{ borderColor: theme.border }}
        >
          <p>
            ยังไม่มีข้อมูลชั้นเรียน กรุณาเพิ่มชั้นเรียน ครู รายวิชา และห้องเรียนในเมนู "ข้อมูลพื้นฐานโรงเรียน" ก่อนจัดตาราง
          </p>
          {canEdit && school && currentUser && (
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await seedSampleDataIntoExistingSchool(
                    school.id,
                    {
                      uid: currentUser.uid,
                      email: currentUser.email || '',
                      displayName: currentUser.displayName || currentUser.email,
                    },
                    activeYear?.id
                  );
                  showToast('สร้างข้อมูลและ User ตัวอย่างสำหรับการทดลองจัดตารางสอนเรียบร้อยแล้ว!', 'success');
                } catch (err) {
                  showToast(formatErrorMessage(err), 'error');
                } finally {
                  setSaving(false);
                }
              }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-white text-xs font-semibold rounded-xl shadow-xs hover:opacity-95 disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
              }}
            >
              <Sparkles className="w-4 h-4" />
              <span>{saving ? 'กำลังสร้างข้อมูลตัวอย่าง...' : 'เติมข้อมูล & User ตัวอย่างสำหรับทดลองจัดตาราง (1 คลิก)'}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Timetable Matrix */}
          <div
            className={`${conflicts.length > 0 ? 'xl:col-span-9' : 'xl:col-span-12'} pastel-glass border rounded-2xl overflow-hidden`}
            style={{ borderColor: theme.border }}
          >
            <DndContext sensors={sensors} onDragEnd={(e) => void handleDragEnd(e)}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-3 text-left font-semibold text-slate-700 w-24 border-r border-slate-200">
                        วัน / คาบ
                      </th>
                      {slots.map((slot) => (
                        <th
                          key={slot.id}
                          className="p-2.5 text-center font-semibold text-slate-700 min-w-[125px] border-r border-slate-200 last:border-r-0"
                        >
                          <div>{slot.label}</div>
                          <div className="text-[11px] font-normal text-slate-500 tabular-nums">
                            {slot.startTime}-{slot.endTime}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((day) => (
                      <tr key={day} className="border-b border-slate-200 last:border-b-0">
                        <td className="p-3 font-bold text-slate-800 bg-slate-50/70 border-r border-slate-200">
                          {DAY_LABELS_TH[day]}
                        </td>
                        {slots.map((slot) => {
                          if (slot.isBreak) {
                            return (
                              <td
                                key={slot.id}
                                className="p-2 text-center bg-slate-100/80 text-slate-400 border-r border-slate-200 last:border-r-0"
                              >
                                พักกลางวัน
                              </td>
                            );
                          }

                          const cellEntries = yearEntries.filter(
                            (e) =>
                              e.classroomId === activeClassroom.id &&
                              e.dayOfWeek === day &&
                              e.periodNumber === slot.periodNumber
                          );

                          const lockActivity = yearActivities.find(
                            (a) =>
                              a.dayOfWeek === day &&
                              a.periodNumber === slot.periodNumber &&
                              doesActivityApplyToClassroom(a, activeClassroom)
                          );

                          return (
                            <DroppableSlotCell
                              key={slot.id}
                              id={`cell_${day}_${slot.periodNumber}`}
                              isBlocked={Boolean(lockActivity)}
                              onClick={() => {
                                if (cellEntries.length === 0) {
                                  openCellModal(day, slot.periodNumber);
                                }
                              }}
                            >
                              {lockActivity && cellEntries.length === 0 ? (
                                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                                  <div className="flex items-center gap-1 font-bold">
                                    <Lock className="w-3 h-3 shrink-0" />
                                    <span>{lockActivity.name}</span>
                                  </div>
                                  <div className="text-[11px] text-amber-700 mt-0.5">
                                    {lockActivity.venue || 'ล็อกกิจกรรม'}
                                  </div>
                                </div>
                              ) : cellEntries.length > 0 ? (
                                <div className="space-y-1">
                                  {cellEntries.map((entry, idx) => {
                                    const subj = subjectMap.get(entry.subjectId);
                                    const teacher = teacherMap.get(entry.teacherId);
                                    const room = roomMap.get(entry.roomId);
                                    const accentColor =
                                      subj?.color ||
                                      PASTEL_SUBJECT_FALLBACKS[
                                        (entry.subjectId.charCodeAt(0) + idx) % PASTEL_SUBJECT_FALLBACKS.length
                                      ];
                                    return (
                                      <DraggableLessonCard
                                        key={entry.id}
                                        entry={entry}
                                        subjectLabel={`${subj?.code || ''} ${subj?.name || ''}`}
                                        teacherLabel={
                                          teacher ? `${teacher.firstName} ${teacher.lastName}` : '-'
                                        }
                                        roomLabel={room ? `${room.code} ${room.name}` : ''}
                                        accentColor={accentColor}
                                        hasConflict={conflictedEntryIds.has(entry.id)}
                                        disabled={!canEdit}
                                        onClick={() => openCellModal(day, slot.periodNumber, entry)}
                                      />
                                    );
                                  })}
                                </div>
                              ) : canEdit ? (
                                <div className="h-14 flex items-center justify-center text-slate-300 hover:text-slate-500">
                                  <Plus className="w-4 h-4" />
                                </div>
                              ) : (
                                <div className="h-14 flex items-center justify-center text-slate-300">-</div>
                              )}
                            </DroppableSlotCell>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DndContext>
          </div>

          {/* Conflict Detection Inspector */}
          {conflicts.length > 0 && (
            <div className="xl:col-span-3 bg-white border border-rose-200 rounded-xl p-4 space-y-3 h-fit">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>พบตารางชน {conflicts.length} จุด</span>
              </div>
              <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                {conflicts.map((c) => (
                  <div key={c.id} className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs space-y-2">
                    <div className="font-bold text-rose-950">{c.title}</div>
                    <div className="text-rose-800">{c.description}</div>

                    {canEdit && c.suggestedSlots.length > 0 && (
                      <div>
                        <div className="font-semibold text-slate-700 mb-1">ย้ายไปคาบว่างแนะนำ:</div>
                        <div className="flex flex-wrap gap-1">
                          {c.suggestedSlots.slice(0, 3).map((s) => (
                            <button
                              key={`${s.dayOfWeek}_${s.periodNumber}`}
                              type="button"
                              onClick={() =>
                                void handleMoveConflictEntry(c.entryIds[0], s.dayOfWeek, s.periodNumber)
                              }
                              className="px-2 py-1 bg-white border border-rose-300 hover:bg-rose-100 rounded text-[11px] font-medium text-slate-800"
                            >
                              {DAY_LABELS_TH[s.dayOfWeek]} คาบ {s.periodNumber}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {canEdit && c.type === 'room' && c.suggestedRooms.length > 0 && (
                      <div>
                        <div className="font-semibold text-slate-700 mb-1">เปลี่ยนเป็นห้องว่าง:</div>
                        <div className="flex flex-wrap gap-1">
                          {c.suggestedRooms.slice(0, 3).map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => void handleChangeConflictRoom(c.entryIds[0], r.id)}
                              className="px-2 py-1 bg-white border border-rose-300 hover:bg-rose-100 rounded text-[11px] font-medium text-slate-800"
                            >
                              {r.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lesson Create/Edit Modal */}
      {lessonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleSaveLesson}
            className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {lessonModal.mode === 'create' ? 'จัดลงตารางสอน' : 'แก้ไขคาบเรียน'}
                </h3>
                <p className="text-xs text-slate-500">
                  {activeClassroom?.name} · วัน{DAY_LABELS_TH[lessonModal.dayOfWeek]} คาบที่ {lessonModal.periodNumber}
                </p>
              </div>
              <button type="button" onClick={() => setLessonModal(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {liveCandidateWarning && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{liveCandidateWarning}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">รายวิชา *</label>
                <select
                  required
                  disabled={!canEdit}
                  value={lessonForm.subjectId}
                  onChange={(e) => {
                    const subj = subjectMap.get(e.target.value);
                    setLessonForm({
                      ...lessonForm,
                      subjectId: e.target.value,
                      teacherId: subj?.defaultTeacherId || lessonForm.teacherId,
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="">เลือกรายวิชา</option>
                  {data.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} {s.name} ({s.gradeLevel})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ครูผู้สอน *</label>
                <select
                  required
                  disabled={!canEdit}
                  value={lessonForm.teacherId}
                  onChange={(e) => setLessonForm({ ...lessonForm, teacherId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="">เลือกครูผู้สอน</option>
                  {data.teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} {t.firstName} {t.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ห้องเรียน</label>
                <select
                  disabled={!canEdit}
                  value={lessonForm.roomId}
                  onChange={(e) => setLessonForm({ ...lessonForm, roomId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="">ไม่ระบุห้อง</option>
                  {data.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} {r.name} (จุ {r.capacity})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between">
              {lessonModal.mode === 'edit' && canEdit ? (
                <button
                  type="button"
                  onClick={() => void handleDeleteLesson()}
                  disabled={saving}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ลบคาบนี้</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLessonModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg"
                >
                  ปิด
                </button>
                {canEdit && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-xs font-semibold text-white rounded-xl disabled:opacity-50 hover:opacity-95"
                    style={{
                      background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                    }}
                  >
                    {saving ? 'กำลังบันทึก...' : 'บันทึกคาบ'}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Versions, Copy Term, and History Modal */}
      {versionModalOpen && school && activeYear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div
            className="bg-white rounded-2xl border max-w-2xl w-full p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">จัดการเวอร์ชัน สำรองข้อมูล และประวัติแก้ไข</h3>
              <button type="button" onClick={() => setVersionModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {canEdit && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Save Version Snapshot */}
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-900">บันทึกเวอร์ชันสำรอง</div>
                  <div className="flex gap-2">
                    <input
                      value={versionName}
                      onChange={(e) => setVersionName(e.target.value)}
                      placeholder="เช่น ฉบับสมบูรณ์ v1"
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!versionName.trim()) return;
                        await createScheduleVersionSnapshot(
                          school.id,
                          activeYear.id,
                          versionName.trim(),
                          yearEntries,
                          actor
                        );
                        setVersionName('');
                        showToast('บันทึกเวอร์ชันตารางสอนแล้ว', 'success');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg"
                    >
                      <Save className="w-3.5 h-3.5" />
                      บันทึก
                    </button>
                  </div>
                </div>

                {/* Copy from previous academic year */}
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-900">คัดลอกตารางจากภาคเรียนอื่น</div>
                  <div className="flex gap-2">
                    <select
                      value={copySourceYearId}
                      onChange={(e) => setCopySourceYearId(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                    >
                      <option value="">เลือกภาคเรียนต้นทาง</option>
                      {data.academicYears
                        .filter((y) => y.id !== activeYear.id)
                        .map((y) => (
                          <option key={y.id} value={y.id}>
                            ปี {y.year} ภาค {y.semester}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!copySourceYearId) return;
                        const count = await copyTimetableBetweenAcademicYears(
                          school.id,
                          copySourceYearId,
                          activeYear.id,
                          actor
                        );
                        showToast(`คัดลอกตารางมา ${count} คาบแล้ว`, 'success');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      คัดลอก
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Saved Versions */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2">
                เวอร์ชันสำรอง ({data.scheduleVersions.length})
              </h4>
              {data.scheduleVersions.length === 0 ? (
                <div className="text-xs text-slate-400">ยังไม่มีเวอร์ชันที่บันทึกไว้</div>
              ) : (
                <div className="space-y-2">
                  {data.scheduleVersions.map((ver) => (
                    <div
                      key={ver.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">{ver.name}</span>
                        <span className="text-slate-500 ml-2">· {ver.entryCount} คาบ</span>
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await confirmAction({
                              title: 'กู้คืนเวอร์ชันตารางสอน?',
                              description: `ตารางสอนปัจจุบันของภาคเรียนนี้จะถูกแทนที่ด้วย "${ver.name}"`,
                            });
                            if (ok) {
                              await restoreScheduleVersionSnapshot(
                                school.id,
                                ver,
                                yearEntries,
                                actor
                              );
                              showToast('กู้คืนตารางสอนเรียบร้อยแล้ว', 'success');
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-800"
                        >
                          <RotateCcw className="w-3 h-3" />
                          กู้คืน
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Edit History */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2">ประวัติการแก้ไขล่าสุด</h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {data.scheduleHistory.slice(0, 20).map((h) => (
                  <div key={h.id} className="text-xs text-slate-600 py-1.5 border-b border-slate-100">
                    <span className="font-mono text-slate-500 mr-2">[{h.action}]</span>
                    <span>{h.summary}</span>
                    <span className="text-slate-400 ml-2">โดย {h.actorEmail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
