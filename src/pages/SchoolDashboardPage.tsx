import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  CalendarRange,
  CheckCircle2,
  Clock,
  Database,
  GraduationCap,
  Lock,
  Sparkles,
  Users,
} from 'lucide-react';
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
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useSchoolWorkspace } from '../hooks/useSchoolWorkspace';
import { formatErrorMessage } from '../lib/firestoreError';
import { DEFAULT_BRANDING } from '../lib/tenant';
import { detectTimetableConflicts } from '../services/conflictService';
import { seedSampleDataIntoExistingSchool } from '../services/demoSeedService';

export function SchoolDashboardPage() {
  const { currentUser } = useAuth();
  const { school, currentPlan, effectiveSchoolRole, isReadOnly } = useTenant();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const data = useSchoolWorkspace();
  const [seedingDemo, setSeedingDemo] = useState(false);

  const activeYear = useMemo(
    () => data.academicYears.find((y) => y.isActive) || data.academicYears[0],
    [data.academicYears]
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

  const conflicts = useMemo(
    () =>
      detectTimetableConflicts({
        entries: yearEntries,
        activities: yearActivities,
        teachers: data.teachers,
        rooms: data.rooms,
        classrooms: data.classrooms,
        subjects: data.subjects,
        timeSlots: data.timeSlots,
        daysOfWeek: activeYear?.daysOfWeek || [1, 2, 3, 4, 5],
      }),
    [yearEntries, yearActivities, data, activeYear]
  );

  const totalRequiredHours = useMemo(() => {
    let total = 0;
    for (const cls of data.classrooms) {
      const gradeSubjs = data.subjects.filter((s) => s.gradeLevel === cls.gradeLevel);
      for (const subj of gradeSubjs) {
        total += subj.hoursPerWeek || 0;
      }
    }
    return total;
  }, [data.classrooms, data.subjects]);

  const scheduledHours = yearEntries.length;
  const missingHours = Math.max(0, totalRequiredHours - scheduledHours);

  const deptChartData = useMemo(() => {
    return data.departments.map((dept) => {
      const deptSubjectIds = new Set(
        data.subjects.filter((s) => s.departmentId === dept.id).map((s) => s.id)
      );
      const count = yearEntries.filter((e) => deptSubjectIds.has(e.subjectId)).length;
      return {
        name: dept.code || dept.name.slice(0, 12),
        fullName: dept.name,
        periods: count,
      };
    });
  }, [data.departments, data.subjects, yearEntries]);

  return (
    <WorkspaceShell
      title="ภาพรวมระบบตารางสอนโรงเรียน"
      breadcrumb={
        activeYear
          ? `ปีการศึกษา ${activeYear.year} ภาคเรียนที่ ${activeYear.semester}`
          : school?.nameTh
      }
      actions={
        <Link
          to="/app/timetable"
          className="inline-flex items-center gap-2 px-4 py-2 text-white text-xs font-semibold rounded-xl transition-opacity hover:opacity-95 shadow-xs whitespace-nowrap shrink-0"
          style={{
            background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
          }}
        >
          <CalendarRange className="w-4 h-4" />
          <span>เปิดตารางสอน</span>
        </Link>
      }
    >
      {data.loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((k) => (
            <div key={k} className="h-28 rounded-2xl bg-white/80 border border-slate-200 animate-pulse p-5" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pastel Welcome Illustration Strip */}
          <div
            className="rounded-2xl border p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center shadow-xs"
            style={{
              borderColor: theme.border,
              background: `linear-gradient(135deg, ${theme.pastelSoft} 0%, ${theme.pastelAlt} 55%, #ffffff 100%)`,
            }}
          >
            <div className="lg:col-span-8 space-y-2">
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/85 text-xs font-semibold"
                style={{ color: theme.primary }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{school?.nameTh} · ธีม {theme.nameTh}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                ศูนย์กลางบริหารงานตารางสอนและทรัพยากรวิชาการ
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
                ตรวจสอบภาระงานสอน อัตราการใช้ห้องเรียน และรายการตารางชนได้ทันทีแบบ Real-time
                สามารถเปลี่ยนโทนสีพาสเทลและเอฟเฟกต์หน้าจอได้จากปุ่มเลือกธีมมุมขวาบน
              </p>
              {(data.teachers.length === 0 || data.classrooms.length === 0) &&
                !isReadOnly &&
                (effectiveSchoolRole === 'super_admin' || effectiveSchoolRole === 'school_admin') &&
                school &&
                currentUser && (
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={seedingDemo}
                      onClick={async () => {
                        setSeedingDemo(true);
                        try {
                          await seedSampleDataIntoExistingSchool(
                            school.id,
                            {
                              uid: currentUser.uid,
                              email: currentUser.email || '',
                              displayName: currentUser.displayName || currentUser.username,
                            },
                            activeYear?.id
                          );
                          showToast('เติมข้อมูลและ User ตัวอย่างสำหรับทดลองจัดตารางเรียบร้อยแล้ว!', 'success');
                        } catch (err) {
                          showToast(formatErrorMessage(err), 'error');
                        } finally {
                          setSeedingDemo(false);
                        }
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 text-white text-xs font-semibold rounded-xl shadow-xs hover:opacity-95 disabled:opacity-50"
                      style={{
                        background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                      }}
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {seedingDemo
                          ? 'กำลังเติมข้อมูลตัวอย่าง...'
                          : 'เติมข้อมูล & User ตัวอย่างสำหรับทดลองจัดตาราง (1 คลิก)'}
                      </span>
                    </button>
                  </div>
                )}
            </div>
            <div className="lg:col-span-4">
              <div
                className="aspect-[16/9] rounded-xl overflow-hidden border bg-white shadow-xs"
                style={{ borderColor: theme.border }}
              >
                <img
                  src={DEFAULT_BRANDING.pastelIllustrationUrl}
                  alt="กราฟิกตารางสอนพาสเทล"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Primary KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'จำนวนครูผู้สอน',
                icon: Users,
                iconBg: 'bg-sky-100 text-sky-700',
                value: `${data.teachers.length}`,
                sub: `/ สูงสุด ${currentPlan.maxTeachers} คน`,
              },
              {
                label: 'ชั้นเรียน และ ห้องเรียน',
                icon: GraduationCap,
                iconBg: 'bg-violet-100 text-violet-700',
                value: `${data.classrooms.length} ชั้น`,
                sub: `· ${data.rooms.length} ห้องเรียน`,
              },
              {
                label: 'รายวิชา และ ชั่วโมงสอน',
                icon: BookOpen,
                iconBg: 'bg-emerald-100 text-emerald-700',
                value: `${scheduledHours} คาบ`,
                sub: `(ยังขาด ${missingHours} คาบ · ${data.subjects.length} วิชา)`,
              },
              {
                label: 'ปัญหาตารางชน (Real-time)',
                icon: conflicts.length > 0 ? AlertTriangle : CheckCircle2,
                iconBg: conflicts.length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-teal-100 text-teal-700',
                value: `${conflicts.length} จุด`,
                valueClass: conflicts.length > 0 ? 'text-rose-600' : 'text-emerald-700',
                sub: conflicts.length > 0 ? 'ต้องแก้ไขในตารางสอน' : 'ไม่มีคาบชนกัน',
              },
            ].map((kpi, idx) => {
              const Icon = kpi.icon;
              return (
                <motion.div
                  key={kpi.label}
                  initial={theme.effectsEnabled ? { opacity: 0, y: 10 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: idx * 0.04 }}
                  className="pastel-glass border rounded-2xl p-5 pastel-card-hover"
                  style={{ borderColor: theme.border }}
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600">
                    <span>{kpi.label}</span>
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${kpi.iconBg}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
                    <span className={`text-2xl font-bold tabular-nums ${kpi.valueClass || 'text-slate-900'}`}>
                      {kpi.value}
                    </span>
                    <span className="text-xs text-slate-500 tabular-nums">{kpi.sub}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Middle Split: Department Load Chart + Quick Workflow */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div
              className="lg:col-span-7 pastel-glass border rounded-2xl p-6"
              style={{ borderColor: theme.border }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">จำนวนคาบสอนที่จัดแล้วรายกลุ่มสาระ</h2>
                  <p className="text-xs text-slate-500">
                    เปรียบเทียบจำนวนคาบสอนทั้งหมดในภาคเรียนปัจจุบัน
                  </p>
                </div>
                <span
                  className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg tabular-nums"
                  style={{ backgroundColor: theme.pastelSoft, color: theme.primary }}
                >
                  รวม {scheduledHours} คาบ
                </span>
              </div>

              {deptChartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-sm text-slate-500">
                  ยังไม่มีข้อมูลกลุ่มสาระการเรียนรู้
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deptChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#475569' }} />
                      <Tooltip
                        formatter={(val: unknown) => [`${val} คาบ`, 'จำนวนคาบ']}
                        labelFormatter={(_, payload) =>
                          (payload?.[0]?.payload as { fullName?: string } | undefined)?.fullName || ''
                        }
                      />
                      <Bar
                        dataKey="periods"
                        fill={theme.primary}
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div
              className="lg:col-span-5 pastel-glass border rounded-2xl p-6 flex flex-col justify-between"
              style={{ borderColor: theme.border }}
            >
              <div>
                <h2 className="text-base font-bold text-slate-900">ขั้นตอนเริ่มต้นใช้งานโรงเรียน</h2>
                <p className="text-xs text-slate-500 mt-1">
                  ตรวจสอบความพร้อมของข้อมูลพื้นฐานก่อนจัดตารางสอน
                </p>

                <div className="mt-5 space-y-2.5">
                  {[
                    {
                      label: 'ข้อมูลครูผู้สอน',
                      count: data.teachers.length,
                      to: '/app/master-data',
                      icon: Users,
                      tile: 'bg-sky-100 text-sky-700',
                    },
                    {
                      label: 'รายวิชาและชั่วโมง/สัปดาห์',
                      count: data.subjects.length,
                      to: '/app/master-data',
                      icon: BookOpen,
                      tile: 'bg-violet-100 text-violet-700',
                    },
                    {
                      label: 'ชั้นเรียนและห้องเรียน',
                      count: data.classrooms.length + data.rooms.length,
                      to: '/app/master-data',
                      icon: Database,
                      tile: 'bg-teal-100 text-teal-700',
                    },
                    {
                      label: 'กิจกรรมล็อกเวลา (ลูกเสือ/ชุมนุม)',
                      count: yearActivities.length,
                      to: '/app/activities',
                      icon: Lock,
                      tile: 'bg-amber-100 text-amber-700',
                    },
                  ].map((step) => {
                    const StepIcon = step.icon;
                    return (
                      <Link
                        key={step.label}
                        to={step.to}
                        className="flex items-center justify-between p-3 rounded-xl border bg-white/80 hover:bg-white transition-all"
                        style={{ borderColor: theme.border }}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${step.tile}`}>
                            <StepIcon className="w-4 h-4" />
                          </span>
                          <span className="text-sm font-medium text-slate-800">{step.label}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
                          {step.count > 0 ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          )}
                          <span>{step.count} รายการ</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  Subdomain: {school?.slug}
                </span>
                <Link to="/app/branding" className="font-semibold hover:underline" style={{ color: theme.primary }}>
                  ตั้งค่าอัตลักษณ์โรงเรียน
                </Link>
              </div>
            </div>
          </div>

          {/* Active Conflicts Preview */}
          {conflicts.length > 0 && (
            <div className="bg-rose-50/90 border border-rose-200 rounded-2xl p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  <h3 className="text-base font-bold text-rose-950">
                    พบรายการตารางชน {conflicts.length} รายการ
                  </h3>
                </div>
                <Link
                  to="/app/timetable"
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl"
                >
                  ไปแก้ไขตาราง
                </Link>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {conflicts.slice(0, 4).map((c) => (
                  <div key={c.id} className="bg-white border border-rose-200 rounded-xl p-3.5">
                    <div className="text-sm font-semibold text-rose-900">{c.title}</div>
                    <div className="text-xs text-rose-700 mt-1">{c.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </WorkspaceShell>
  );
}
