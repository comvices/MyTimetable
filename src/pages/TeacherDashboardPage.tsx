import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Clock, Lock, Sparkles, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { WorkspaceShell } from '../components/layout/WorkspaceShell';
import { useTenant } from '../contexts/TenantContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSchoolWorkspace } from '../hooks/useSchoolWorkspace';
import { DAY_LABELS_TH } from '../types/school';

const PASTEL_SUBJECT_FALLBACKS = [
  '#4A7BD0',
  '#2E8B71',
  '#7858C4',
  '#C95D75',
  '#B57428',
  '#3A8A9C',
];

export function TeacherDashboardPage() {
  const { member, school, hasFeature, previewTeacherId } = useTenant();
  const { theme } = useTheme();
  const data = useSchoolWorkspace();
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

  const canUseTeacherDashboard = hasFeature('teacher_dashboard');

  const activeTeacher = useMemo(() => {
    if (selectedTeacherId) {
      return data.teachers.find((t) => t.id === selectedTeacherId) || data.teachers[0];
    }
    if (previewTeacherId) {
      return data.teachers.find((t) => t.id === previewTeacherId) || data.teachers[0];
    }
    if (member?.teacherId) {
      return data.teachers.find((t) => t.id === member.teacherId) || data.teachers[0];
    }
    return data.teachers[0];
  }, [data.teachers, selectedTeacherId, previewTeacherId, member?.teacherId]);

  const activeYear = useMemo(
    () => data.academicYears.find((y) => y.isActive) || data.academicYears[0],
    [data.academicYears]
  );

  const days = activeYear?.daysOfWeek || [1, 2, 3, 4, 5];
  const slots = useMemo(
    () => [...data.timeSlots].sort((a, b) => a.periodNumber - b.periodNumber),
    [data.timeSlots]
  );

  const teacherEntries = useMemo(() => {
    if (!activeTeacher) return [];
    return data.timetables.filter(
      (e) =>
        e.teacherId === activeTeacher.id &&
        (!activeYear || e.academicYearId === activeYear.id)
    );
  }, [data.timetables, activeTeacher, activeYear]);

  const teachableSlotsCount = slots.filter((s) => !s.isBreak).length * days.length;
  const freeHours = Math.max(0, teachableSlotsCount - teacherEntries.length);

  const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));
  const classMap = new Map(data.classrooms.map((c) => [c.id, c]));
  const roomMap = new Map(data.rooms.map((r) => [r.id, r]));

  const taughtSubjects = Array.from(
    new Set(teacherEntries.map((e) => subjectMap.get(e.subjectId)?.name).filter(Boolean))
  );
  const taughtClasses = Array.from(
    new Set(teacherEntries.map((e) => classMap.get(e.classroomId)?.name).filter(Boolean))
  );

  return (
    <WorkspaceShell
      title="แดชบอร์ดและตารางสอนครูรายบุคคล"
      breadcrumb={school?.nameTh}
      actions={
        canUseTeacherDashboard ? (
          <select
            value={activeTeacher?.id || ''}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            className="px-3 py-2 rounded-xl border bg-white/90 text-sm font-medium text-slate-800"
            style={{ borderColor: theme.border }}
          >
            {data.teachers.length === 0 && <option value="">ยังไม่มีข้อมูลครู</option>}
            {data.teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.firstName} {t.lastName}
              </option>
            ))}
          </select>
        ) : null
      }
    >
      {!canUseTeacherDashboard ? (
        <div
          className="pastel-glass border rounded-2xl p-8 text-center max-w-xl mx-auto"
          style={{ borderColor: theme.border }}
        >
          <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            ฟีเจอร์แดชบอร์ดครูรายบุคคลสำหรับแพ็กเกจ Professional ขึ้นไป
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            อัปเกรดแพ็กเกจเพื่อดูภาระงานสอน คาบว่างรายสัปดาห์ และตารางสอนเฉพาะครูแต่ละท่านแบบเรียลไทม์
          </p>
          <Link
            to="/app/billing"
            className="inline-flex items-center gap-1.5 mt-5 px-5 py-2.5 text-white text-xs font-semibold rounded-xl shadow-xs"
            style={{
              background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
            }}
          >
            <Sparkles className="w-4 h-4" />
            ดูแพ็กเกจและอัปเกรด
          </Link>
        </div>
      ) : !activeTeacher ? (
        <div
          className="pastel-glass border rounded-2xl p-10 text-center text-sm text-slate-500"
          style={{ borderColor: theme.border }}
        >
          ยังไม่มีข้อมูลครูผู้สอน กรุณาเพิ่มข้อมูลครูในเมนู "ข้อมูลพื้นฐานโรงเรียน"
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className="pastel-glass pastel-card-hover border rounded-2xl p-5"
              style={{ borderColor: theme.border }}
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>ชั่วโมงสอนต่อสัปดาห์</span>
                <span className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {teacherEntries.length} / {activeTeacher.maxHoursPerWeek} คาบ
              </div>
            </div>

            <div
              className="pastel-glass pastel-card-hover border rounded-2xl p-5"
              style={{ borderColor: theme.border }}
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>คาบว่างทั้งหมด</span>
                <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-700 tabular-nums">
                {freeHours} คาบ
              </div>
            </div>

            <div
              className="pastel-glass pastel-card-hover border rounded-2xl p-5"
              style={{ borderColor: theme.border }}
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>รายวิชาที่สอน</span>
                <span className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900 leading-relaxed">
                {taughtSubjects.length > 0 ? taughtSubjects.join(', ') : 'ยังไม่มีวิชาที่ลงตาราง'}
              </div>
            </div>

            <div
              className="pastel-glass pastel-card-hover border rounded-2xl p-5"
              style={{ borderColor: theme.border }}
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>ชั้นเรียนที่รับผิดชอบ</span>
                <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900 leading-relaxed">
                {taughtClasses.length > 0 ? taughtClasses.join(', ') : '-'}
              </div>
            </div>
          </div>

          {/* Individual Timetable Grid */}
          <div
            className="pastel-glass border rounded-2xl overflow-hidden"
            style={{ borderColor: theme.border }}
          >
            <div
              className="px-6 py-4 border-b flex items-center justify-between"
              style={{ borderColor: theme.border, backgroundColor: theme.pastelSoft }}
            >
              <h2 className="text-base font-bold text-slate-900">
                ตารางสอน: {activeTeacher.firstName} {activeTeacher.lastName} ({activeTeacher.code})
              </h2>
              <span className="text-xs font-medium text-slate-600">{activeTeacher.position || 'ครูผู้สอน'}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200">
                    <th className="p-3 text-left font-semibold text-slate-700 w-24 border-r border-slate-200">
                      วัน / คาบ
                    </th>
                    {slots.map((slot) => (
                      <th
                        key={slot.id}
                        className="p-2.5 text-center font-semibold text-slate-700 min-w-[115px] border-r border-slate-200 last:border-r-0"
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
                      <td className="p-3 font-semibold text-slate-800 bg-slate-50/70 border-r border-slate-200">
                        {DAY_LABELS_TH[day]}
                      </td>
                      {slots.map((slot) => {
                        if (slot.isBreak) {
                          return (
                            <td
                              key={slot.id}
                              className="p-2 text-center bg-slate-100/70 text-slate-400 border-r border-slate-200 last:border-r-0"
                            >
                              พัก
                            </td>
                          );
                        }
                        const items = teacherEntries.filter(
                          (e) => e.dayOfWeek === day && e.periodNumber === slot.periodNumber
                        );
                        return (
                          <td
                            key={slot.id}
                            className="p-2 align-top border-r border-slate-200 last:border-r-0"
                          >
                            {items.length === 0 ? (
                              <div className="text-center text-slate-300 py-3">ว่าง</div>
                            ) : (
                              <div className="space-y-1">
                                {items.map((item, idx) => {
                                  const subj = subjectMap.get(item.subjectId);
                                  const cls = classMap.get(item.classroomId);
                                  const room = roomMap.get(item.roomId);
                                  const accent =
                                    subj?.color ||
                                    PASTEL_SUBJECT_FALLBACKS[
                                      (item.subjectId.charCodeAt(0) + idx) % PASTEL_SUBJECT_FALLBACKS.length
                                    ];
                                  return (
                                    <div
                                      key={item.id}
                                      className="p-2 rounded-xl border"
                                      style={{
                                        backgroundColor: `${accent}16`,
                                        borderColor: `${accent}4D`,
                                      }}
                                    >
                                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                        <span
                                          className="w-2 h-2 rounded-full shrink-0"
                                          style={{ backgroundColor: accent }}
                                        />
                                        <span className="truncate">
                                          {subj?.code} {subj?.name}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-600 mt-0.5">
                                        {cls?.name} · {room?.code || '-'}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}
    </WorkspaceShell>
  );
}
