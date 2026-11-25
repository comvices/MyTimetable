import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CheckCircle2, Lock, Sparkles, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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

export function RoomDashboardPage() {
  const { school, hasFeature } = useTenant();
  const { theme } = useTheme();
  const data = useSchoolWorkspace();
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  const canUseRoomDashboard = hasFeature('room_dashboard');

  const activeYear = useMemo(
    () => data.academicYears.find((y) => y.isActive) || data.academicYears[0],
    [data.academicYears]
  );
  const days = activeYear?.daysOfWeek || [1, 2, 3, 4, 5];
  const slots = useMemo(
    () => [...data.timeSlots].sort((a, b) => a.periodNumber - b.periodNumber),
    [data.timeSlots]
  );

  const totalWeeklySlots = Math.max(1, slots.filter((s) => !s.isBreak).length * days.length);

  const roomStats = useMemo(() => {
    return data.rooms.map((room) => {
      const usedPeriods = data.timetables.filter(
        (e) => e.roomId === room.id && (!activeYear || e.academicYearId === activeYear.id)
      ).length;
      const actPeriods = data.activities.filter(
        (a) => a.roomId === room.id && (!activeYear || a.academicYearId === activeYear.id)
      ).length;
      const totalUsed = usedPeriods + actPeriods;
      const rate = Math.min(100, Math.round((totalUsed / totalWeeklySlots) * 100));
      return {
        room,
        totalUsed,
        freeSlots: Math.max(0, totalWeeklySlots - totalUsed),
        rate,
      };
    });
  }, [data.rooms, data.timetables, data.activities, activeYear, totalWeeklySlots]);

  const sortedByUsage = [...roomStats].sort((a, b) => b.rate - a.rate);
  const busiestRoom = sortedByUsage[0];
  const freestRoom = sortedByUsage[sortedByUsage.length - 1];
  const avgUtilization =
    roomStats.length > 0
      ? Math.round(roomStats.reduce((sum, r) => sum + r.rate, 0) / roomStats.length)
      : 0;

  const activeRoom = data.rooms.find((r) => r.id === selectedRoomId) || data.rooms[0];

  const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));
  const teacherMap = new Map(data.teachers.map((t) => [t.id, t]));
  const classMap = new Map(data.classrooms.map((c) => [c.id, c]));

  return (
    <WorkspaceShell title="แดชบอร์ดอัตราการใช้ห้องเรียน" breadcrumb={school?.nameTh}>
      {!canUseRoomDashboard ? (
        <div
          className="pastel-glass border rounded-2xl p-8 text-center max-w-xl mx-auto"
          style={{ borderColor: theme.border }}
        >
          <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            ฟีเจอร์แดชบอร์ดอัตราการใช้ห้องสำหรับแพ็กเกจ Professional ขึ้นไป
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            อัปเกรดแพ็กเกจเพื่อวิเคราะห์อัตราการใช้งานห้องเรียน ห้องปฏิบัติการ และดูตารางห้องว่างรายสัปดาห์
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
      ) : data.rooms.length === 0 ? (
        <div
          className="pastel-glass border rounded-2xl p-10 text-center text-sm text-slate-500"
          style={{ borderColor: theme.border }}
        >
          ยังไม่มีข้อมูลห้องเรียน กรุณาเพิ่มห้องเรียนในเมนู "ข้อมูลพื้นฐานโรงเรียน"
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              className="pastel-glass pastel-card-hover border rounded-2xl p-5"
              style={{ borderColor: theme.border }}
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>อัตราการใช้ห้องเฉลี่ย</span>
                <span className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {avgUtilization}%
              </div>
            </div>

            <div
              className="pastel-glass pastel-card-hover border rounded-2xl p-5"
              style={{ borderColor: theme.border }}
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>ห้องที่ใช้งานมากที่สุด</span>
                <span className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-base font-bold text-slate-900">
                {busiestRoom ? `${busiestRoom.room.code} ${busiestRoom.room.name}` : '-'}
              </div>
              <div className="text-xs text-slate-500 tabular-nums">
                {busiestRoom ? `${busiestRoom.totalUsed} คาบ (${busiestRoom.rate}%)` : ''}
              </div>
            </div>

            <div
              className="pastel-glass pastel-card-hover border rounded-2xl p-5"
              style={{ borderColor: theme.border }}
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>ห้องที่ว่างมากที่สุด</span>
                <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-base font-bold text-slate-900">
                {freestRoom ? `${freestRoom.room.code} ${freestRoom.room.name}` : '-'}
              </div>
              <div className="text-xs text-slate-500 tabular-nums">
                {freestRoom ? `ว่าง ${freestRoom.freeSlots} คาบ/สัปดาห์` : ''}
              </div>
            </div>
          </div>

          {/* Room Utilization Bar Chart */}
          <div
            className="pastel-glass border rounded-2xl p-6"
            style={{ borderColor: theme.border }}
          >
            <h2 className="text-base font-bold text-slate-900 mb-4">อัตราการใช้ห้องเรียนแต่ละห้อง (%)</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={roomStats.map((r) => ({
                    code: r.room.code,
                    name: r.room.name,
                    rate: r.rate,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="code" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#475569' }} />
                  <Tooltip formatter={(val: unknown) => [`${val}%`, 'อัตราการใช้']} />
                  <Bar dataKey="rate" fill={theme.primary} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Individual Room Weekly Grid */}
          {activeRoom && (
            <div
              className="pastel-glass border rounded-2xl overflow-hidden"
              style={{ borderColor: theme.border }}
            >
              <div
                className="px-6 py-4 border-b flex flex-wrap items-center justify-between gap-3"
                style={{ borderColor: theme.border, backgroundColor: theme.pastelSoft }}
              >
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    ตารางการใช้ห้องรายสัปดาห์: {activeRoom.code} — {activeRoom.name}
                  </h2>
                  <p className="text-xs text-slate-600">
                    {activeRoom.building || 'อาคารเรียน'} · ความจุ {activeRoom.capacity} ที่นั่ง
                  </p>
                </div>
                <select
                  value={activeRoom.id}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="px-3 py-2 rounded-xl border bg-white/95 text-sm font-medium"
                  style={{ borderColor: theme.border }}
                >
                  {data.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} — {r.name}
                    </option>
                  ))}
                </select>
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
                          const items = data.timetables.filter(
                            (e) =>
                              e.roomId === activeRoom.id &&
                              e.dayOfWeek === day &&
                              e.periodNumber === slot.periodNumber &&
                              (!activeYear || e.academicYearId === activeYear.id)
                          );
                          const act = data.activities.find(
                            (a) =>
                              a.roomId === activeRoom.id &&
                              a.dayOfWeek === day &&
                              a.periodNumber === slot.periodNumber
                          );

                          return (
                            <td
                              key={slot.id}
                              className="p-2 align-top border-r border-slate-200 last:border-r-0"
                            >
                              {items.length > 0 ? (
                                items.map((item, idx) => {
                                  const cls = classMap.get(item.classroomId);
                                  const subj = subjectMap.get(item.subjectId);
                                  const t = teacherMap.get(item.teacherId);
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
                                        <span className="truncate">{cls?.name}</span>
                                      </div>
                                      <div className="text-[11px] text-slate-600 mt-0.5">
                                        {subj?.code} · {t ? `${t.firstName}` : ''}
                                      </div>
                                    </div>
                                  );
                                })
                              ) : act ? (
                                <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                                  <div className="font-bold">กิจกรรม</div>
                                  <div className="text-[11px]">{act.name}</div>
                                </div>
                              ) : (
                                <div className="text-center text-slate-300 py-3">ว่าง</div>
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
          )}
        </motion.div>
      )}
    </WorkspaceShell>
  );
}
