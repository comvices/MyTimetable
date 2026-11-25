import React, { useState } from 'react';
import { CheckCircle2, Edit2, Info, Plus, Search, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { WorkspaceShell } from '../components/layout/WorkspaceShell';
import { useTenant } from '../contexts/TenantContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useSchoolWorkspace } from '../hooks/useSchoolWorkspace';
import { formatErrorMessage } from '../lib/firestoreError';
import { generateId } from '../lib/tenant';
import {
  activateSchoolAcademicYear,
  deleteSchoolDoc,
  syncSchoolTeacherCount,
  upsertSchoolDoc,
} from '../services/schoolService';

type MasterTab =
  | 'teachers'
  | 'subjects'
  | 'departments'
  | 'classrooms'
  | 'rooms'
  | 'timeSlots'
  | 'academicYears';

const PASTEL_SWATCHES = [
  '#4A7BD0',
  '#2E8B71',
  '#7858C4',
  '#C95D75',
  '#B57428',
  '#3A8A9C',
  '#D98245',
  '#5D7D9A',
];

export function MasterDataPage() {
  const { school, currentPlan, isReadOnly, effectiveSchoolRole } = useTenant();
  const { theme } = useTheme();
  const { showToast, confirmAction } = useToast();
  const data = useSchoolWorkspace();

  const [tab, setTab] = useState<MasterTab>('teachers');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [fields, setFields] = useState<Record<string, unknown>>({});

  if (!school) {
    return (
      <WorkspaceShell title="ข้อมูลพื้นฐานโรงเรียน">
        <div
          className="p-8 pastel-glass rounded-2xl border text-sm text-slate-500"
          style={{ borderColor: theme.border }}
        >
          กำลังโหลด...
        </div>
      </WorkspaceShell>
    );
  }

  const canManageMaster =
    effectiveSchoolRole === 'super_admin' || effectiveSchoolRole === 'school_admin';
  const canEdit = !isReadOnly && canManageMaster;

  const openCreate = () => {
    if (!canManageMaster) {
      showToast('การเพิ่มหรือแก้ไขข้อมูลพื้นฐานสงวนสิทธิ์เฉพาะผู้ดูแลโรงเรียน (School Admin)', 'warning');
      return;
    }
    if (isReadOnly) {
      showToast('โรงเรียนอยู่ในโหมดอ่านอย่างเดียว ไม่สามารถเพิ่มข้อมูลได้', 'warning');
      return;
    }
    if (tab === 'teachers' && data.teachers.length >= currentPlan.maxTeachers) {
      showToast(
        `แพ็กเกจ ${currentPlan.name} รองรับครูได้สูงสุด ${currentPlan.maxTeachers} คน กรุณาอัปเกรดแพ็กเกจ`,
        'warning'
      );
      return;
    }

    setEditingId(null);
    if (tab === 'teachers') {
      setFields({
        code: `T${String(data.teachers.length + 1).padStart(3, '0')}`,
        firstName: '',
        lastName: '',
        departmentId: data.departments[0]?.id || '',
        position: 'ครู',
        maxHoursPerWeek: 20,
        email: '',
      });
    } else if (tab === 'subjects') {
      setFields({
        code: '',
        name: '',
        departmentId: data.departments[0]?.id || '',
        gradeLevel: 'ม.1',
        credits: 1,
        hoursPerWeek: 2,
        defaultTeacherId: data.teachers[0]?.id || '',
        color: PASTEL_SWATCHES[data.subjects.length % PASTEL_SWATCHES.length],
      });
    } else if (tab === 'departments') {
      setFields({
        code: '',
        name: '',
        color: PASTEL_SWATCHES[data.departments.length % PASTEL_SWATCHES.length],
      });
    } else if (tab === 'classrooms') {
      setFields({ name: '', gradeLevel: 'ม.1', homeroomTeacherId: '', studentCount: 35 });
    } else if (tab === 'rooms') {
      setFields({
        code: '',
        name: '',
        building: 'อาคาร 1',
        floor: '2',
        roomType: 'ห้องเรียนปกติ',
        capacity: 40,
      });
    } else if (tab === 'timeSlots') {
      setFields({
        periodNumber: data.timeSlots.length + 1,
        label: `คาบที่ ${data.timeSlots.length + 1}`,
        startTime: '15:30',
        endTime: '16:20',
        isBreak: false,
      });
    } else {
      setFields({
        year: String(new Date().getFullYear() + 543),
        semester: '1',
        isActive: true,
        daysOfWeek: [1, 2, 3, 4, 5],
      });
    }
    setModalOpen(true);
  };

  const openEdit = (item: Record<string, unknown>) => {
    if (!canEdit) return;
    setEditingId(String(item.id));
    setFields({ ...item });
    setModalOpen(true);
  };

  const activateSingleAcademicYear = async (targetId: string, _year: string, _semester: string) => {
    await activateSchoolAcademicYear(school.id, targetId);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      const id = editingId || generateId(tab.slice(0, 3));
      const payload = { ...fields };
      delete payload.createdAt;
      delete payload.updatedAt;

      if (tab === 'teachers') payload.maxHoursPerWeek = Number(payload.maxHoursPerWeek || 20);
      if (tab === 'subjects') {
        payload.credits = Number(payload.credits || 1);
        payload.hoursPerWeek = Number(payload.hoursPerWeek || 2);
        payload.color = String(payload.color || '#4A7BD0');
      }
      if (tab === 'classrooms') payload.studentCount = Number(payload.studentCount || 35);
      if (tab === 'rooms') payload.capacity = Number(payload.capacity || 40);
      if (tab === 'timeSlots') {
        payload.periodNumber = Number(payload.periodNumber || 1);
        payload.isBreak = Boolean(payload.isBreak);
      }
      if (tab === 'academicYears') {
        payload.isActive = Boolean(payload.isActive);
      }

      await upsertSchoolDoc(school.id, tab, id, payload, !editingId);
      if (tab === 'academicYears' && payload.isActive === true) {
        await activateSingleAcademicYear(
          id,
          String(payload.year || school.academicYear),
          String(payload.semester || school.semester)
        );
      }
      if (tab === 'teachers' && !editingId) {
        await syncSchoolTeacherCount(school.id, data.teachers.length + 1);
      }
      setModalOpen(false);
      showToast('บันทึกข้อมูลสำเร็จ', 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!canEdit) return;
    const ok = await confirmAction({
      title: 'ยืนยันการลบข้อมูล?',
      description: `ต้องการลบ "${label}" ออกจากระบบหรือไม่`,
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteSchoolDoc(school.id, tab, id);
      if (tab === 'teachers') {
        await syncSchoolTeacherCount(school.id, Math.max(0, data.teachers.length - 1));
      }
      showToast('ลบข้อมูลเรียบร้อยแล้ว', 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    }
  };

  const deptMap = new Map(data.departments.map((d) => [d.id, d.name]));
  const teacherMap = new Map(data.teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`]));

  const q = search.trim().toLowerCase();

  return (
    <WorkspaceShell
      title="ข้อมูลพื้นฐานโรงเรียน"
      breadcrumb={`${school.nameTh} · ครู ${data.teachers.length}/${currentPlan.maxTeachers} คน`}
      actions={
        canEdit ? (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-white text-xs font-semibold rounded-xl shadow-xs hover:opacity-95 whitespace-nowrap shrink-0"
            style={{
              background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
            }}
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มข้อมูลใหม่</span>
          </button>
        ) : null
      }
    >
      {!canManageMaster && (
        <div
          className="mb-5 p-4 rounded-2xl border flex items-center gap-3 text-xs text-slate-700"
          style={{ backgroundColor: theme.pastelSoft, borderColor: theme.border }}
        >
          <Info className="w-4 h-4 shrink-0" style={{ color: theme.primary }} />
          <span>
            โหมดดูข้อมูลพื้นฐาน — การเพิ่ม แก้ไข หรือลบข้อมูลหลักสงวนสิทธิ์เฉพาะผู้ดูแลโรงเรียน (School Admin)
          </span>
        </div>
      )}

      {/* Tabs + Search */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div
          className="flex flex-wrap items-center gap-1 p-1.5 rounded-2xl border"
          style={{ backgroundColor: theme.pastelSoft, borderColor: theme.border }}
        >
          {[
            { id: 'teachers', label: `ครู (${data.teachers.length})` },
            { id: 'subjects', label: `รายวิชา (${data.subjects.length})` },
            { id: 'classrooms', label: `ชั้นเรียน (${data.classrooms.length})` },
            { id: 'rooms', label: `ห้องเรียน (${data.rooms.length})` },
            { id: 'departments', label: `กลุ่มสาระ (${data.departments.length})` },
            { id: 'timeSlots', label: `คาบเรียน (${data.timeSlots.length})` },
            { id: 'academicYears', label: `ปีการศึกษา (${data.academicYears.length})` },
          ].map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id as MasterTab);
                  setSearch('');
                }}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                style={active ? { color: theme.primary } : undefined}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาข้อมูล..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border bg-white/90 text-xs focus:outline-none"
            style={{ borderColor: theme.border }}
          />
        </div>
      </div>

      {/* Data Table */}
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="pastel-glass border rounded-2xl overflow-hidden"
        style={{ borderColor: theme.border }}
      >
        <div className="overflow-x-auto">
          {tab === 'teachers' && (
            <table className="w-full text-sm">
              <thead
                className="border-b text-xs text-slate-700"
                style={{ backgroundColor: theme.pastelSoft, borderColor: theme.border }}
              >
                <tr>
                  <th className="p-3.5 text-left">รหัส</th>
                  <th className="p-3.5 text-left">ชื่อ-นามสกุล</th>
                  <th className="p-3.5 text-left">กลุ่มสาระ</th>
                  <th className="p-3.5 text-left">ตำแหน่ง</th>
                  <th className="p-3.5 text-right">ชม./สัปดาห์</th>
                  <th className="p-3.5 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {data.teachers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-slate-500">
                      ยังไม่มีข้อมูลครู กด "เพิ่มข้อมูลใหม่" เพื่อเริ่มต้น
                    </td>
                  </tr>
                ) : (
                  data.teachers
                    .filter((t) =>
                      `${t.code} ${t.firstName} ${t.lastName}`.toLowerCase().includes(q)
                    )
                    .map((t) => (
                      <tr key={t.id} className="border-b border-slate-100 last:border-b-0 hover:bg-white/60">
                        <td className="p-3.5 font-mono text-xs font-semibold text-slate-700">{t.code}</td>
                        <td className="p-3.5 font-semibold text-slate-900">
                          {t.firstName} {t.lastName}
                        </td>
                        <td className="p-3.5 text-slate-600">{deptMap.get(t.departmentId || '') || '-'}</td>
                        <td className="p-3.5 text-slate-600">{t.position || '-'}</td>
                        <td className="p-3.5 text-right tabular-nums">{t.maxHoursPerWeek}</td>
                        <td className="p-3.5 text-right space-x-2">
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => openEdit(t as unknown as Record<string, unknown>)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-35 rounded-lg hover:bg-slate-100"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => void handleDelete(t.id, `${t.firstName} ${t.lastName}`)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 disabled:opacity-35 rounded-lg hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          )}

          {tab === 'subjects' && (
            <table className="w-full text-sm">
              <thead
                className="border-b text-xs text-slate-700"
                style={{ backgroundColor: theme.pastelSoft, borderColor: theme.border }}
              >
                <tr>
                  <th className="p-3.5 text-left">รหัสวิชา</th>
                  <th className="p-3.5 text-left">ชื่อวิชา</th>
                  <th className="p-3.5 text-left">ระดับชั้น</th>
                  <th className="p-3.5 text-left">ครูผู้สอนหลัก</th>
                  <th className="p-3.5 text-right">หน่วยกิต</th>
                  <th className="p-3.5 text-right">ชม./สัปดาห์</th>
                  <th className="p-3.5 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {data.subjects.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-xs text-slate-500">
                      ยังไม่มีข้อมูลรายวิชา กด "เพิ่มข้อมูลใหม่" เพื่อเริ่มต้น
                    </td>
                  </tr>
                ) : (
                  data.subjects
                    .filter((s) => `${s.code} ${s.name} ${s.gradeLevel}`.toLowerCase().includes(q))
                    .map((s) => (
                      <tr key={s.id} className="border-b border-slate-100 last:border-b-0 hover:bg-white/60">
                        <td className="p-3.5 font-mono text-xs font-semibold">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: s.color || '#4A7BD0' }}
                            />
                            {s.code}
                          </span>
                        </td>
                        <td className="p-3.5 font-semibold text-slate-900">{s.name}</td>
                        <td className="p-3.5 text-slate-600">{s.gradeLevel}</td>
                        <td className="p-3.5 text-slate-600">
                          {teacherMap.get(s.defaultTeacherId || '') || '-'}
                        </td>
                        <td className="p-3.5 text-right tabular-nums">{s.credits}</td>
                        <td className="p-3.5 text-right tabular-nums">{s.hoursPerWeek}</td>
                        <td className="p-3.5 text-right space-x-2">
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => openEdit(s as unknown as Record<string, unknown>)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-35 rounded-lg hover:bg-slate-100"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => void handleDelete(s.id, s.name)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 disabled:opacity-35 rounded-lg hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          )}

          {tab === 'classrooms' && (
            <table className="w-full text-sm">
              <thead
                className="border-b text-xs text-slate-700"
                style={{ backgroundColor: theme.pastelSoft, borderColor: theme.border }}
              >
                <tr>
                  <th className="p-3.5 text-left">ชื่อชั้นเรียน</th>
                  <th className="p-3.5 text-left">ระดับชั้น</th>
                  <th className="p-3.5 text-left">ครูประจำชั้น</th>
                  <th className="p-3.5 text-right">จำนวนนักเรียน</th>
                  <th className="p-3.5 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {data.classrooms.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-xs text-slate-500">
                      ยังไม่มีข้อมูลชั้นเรียน กด "เพิ่มข้อมูลใหม่" เพื่อเริ่มต้น
                    </td>
                  </tr>
                ) : (
                  data.classrooms
                    .filter((c) => `${c.name} ${c.gradeLevel}`.toLowerCase().includes(q))
                    .map((c) => (
                      <tr key={c.id} className="border-b border-slate-100 last:border-b-0 hover:bg-white/60">
                        <td className="p-3.5 font-semibold text-slate-900">{c.name}</td>
                        <td className="p-3.5 text-slate-600">{c.gradeLevel}</td>
                        <td className="p-3.5 text-slate-600">
                          {teacherMap.get(c.homeroomTeacherId || '') || '-'}
                        </td>
                        <td className="p-3.5 text-right tabular-nums">{c.studentCount || 0}</td>
                        <td className="p-3.5 text-right space-x-2">
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => openEdit(c as unknown as Record<string, unknown>)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-35 rounded-lg hover:bg-slate-100"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => void handleDelete(c.id, c.name)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 disabled:opacity-35 rounded-lg hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          )}

          {tab === 'rooms' && (
            <table className="w-full text-sm">
              <thead
                className="border-b text-xs text-slate-700"
                style={{ backgroundColor: theme.pastelSoft, borderColor: theme.border }}
              >
                <tr>
                  <th className="p-3.5 text-left">รหัสห้อง</th>
                  <th className="p-3.5 text-left">ชื่อห้อง</th>
                  <th className="p-3.5 text-left">อาคาร / ชั้น</th>
                  <th className="p-3.5 text-left">ประเภท</th>
                  <th className="p-3.5 text-right">ความจุ</th>
                  <th className="p-3.5 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {data.rooms.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-slate-500">
                      ยังไม่มีข้อมูลห้องเรียน กด "เพิ่มข้อมูลใหม่" เพื่อเริ่มต้น
                    </td>
                  </tr>
                ) : (
                  data.rooms
                    .filter((r) => `${r.code} ${r.name} ${r.building}`.toLowerCase().includes(q))
                    .map((r) => (
                      <tr key={r.id} className="border-b border-slate-100 last:border-b-0 hover:bg-white/60">
                        <td className="p-3.5 font-mono text-xs font-semibold">{r.code}</td>
                        <td className="p-3.5 font-semibold text-slate-900">{r.name}</td>
                        <td className="p-3.5 text-slate-600">
                          {r.building || '-'} ชั้น {r.floor || '-'}
                        </td>
                        <td className="p-3.5 text-slate-600">{r.roomType}</td>
                        <td className="p-3.5 text-right tabular-nums">{r.capacity}</td>
                        <td className="p-3.5 text-right space-x-2">
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => openEdit(r as unknown as Record<string, unknown>)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-35 rounded-lg hover:bg-slate-100"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => void handleDelete(r.id, r.name)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 disabled:opacity-35 rounded-lg hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          )}

          {tab === 'departments' && (
            <table className="w-full text-sm">
              <thead
                className="border-b text-xs text-slate-700"
                style={{ backgroundColor: theme.pastelSoft, borderColor: theme.border }}
              >
                <tr>
                  <th className="p-3.5 text-left">รหัส</th>
                  <th className="p-3.5 text-left">ชื่อกลุ่มสาระ</th>
                  <th className="p-3.5 text-left">สี</th>
                  <th className="p-3.5 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {data.departments.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100 last:border-b-0 hover:bg-white/60">
                    <td className="p-3.5 font-mono text-xs">{d.code || '-'}</td>
                    <td className="p-3.5 font-semibold text-slate-900">{d.name}</td>
                    <td className="p-3.5">
                      <span
                        className="inline-block w-5 h-5 rounded-md border border-slate-200 shadow-2xs"
                        style={{ backgroundColor: d.color }}
                      />
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => openEdit(d as unknown as Record<string, unknown>)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-35 rounded-lg hover:bg-slate-100"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => void handleDelete(d.id, d.name)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 disabled:opacity-35 rounded-lg hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'timeSlots' && (
            <table className="w-full text-sm">
              <thead
                className="border-b text-xs text-slate-700"
                style={{ backgroundColor: theme.pastelSoft, borderColor: theme.border }}
              >
                <tr>
                  <th className="p-3.5 text-left">คาบที่</th>
                  <th className="p-3.5 text-left">ชื่อคาบ</th>
                  <th className="p-3.5 text-left">เวลาเริ่มต้น</th>
                  <th className="p-3.5 text-left">เวลาสิ้นสุด</th>
                  <th className="p-3.5 text-left">ประเภท</th>
                  <th className="p-3.5 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {data.timeSlots.map((slot) => (
                  <tr key={slot.id} className="border-b border-slate-100 last:border-b-0 hover:bg-white/60">
                    <td className="p-3.5 font-mono tabular-nums">{slot.periodNumber}</td>
                    <td className="p-3.5 font-semibold text-slate-900">{slot.label}</td>
                    <td className="p-3.5 font-mono tabular-nums">{slot.startTime}</td>
                    <td className="p-3.5 font-mono tabular-nums">{slot.endTime}</td>
                    <td className="p-3.5">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium border ${
                          slot.isBreak
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : 'bg-sky-50 border-sky-200 text-sky-800'
                        }`}
                      >
                        {slot.isBreak ? 'เวลาพักกลางวัน' : 'คาบเรียน'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => openEdit(slot as unknown as Record<string, unknown>)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-35 rounded-lg hover:bg-slate-100"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => void handleDelete(slot.id, slot.label)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 disabled:opacity-35 rounded-lg hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'academicYears' && (
            <table className="w-full text-sm">
              <thead
                className="border-b text-xs text-slate-700"
                style={{ backgroundColor: theme.pastelSoft, borderColor: theme.border }}
              >
                <tr>
                  <th className="p-3.5 text-left">ปีการศึกษา</th>
                  <th className="p-3.5 text-left">ภาคเรียน</th>
                  <th className="p-3.5 text-left">จำนวนวันเรียน/สัปดาห์</th>
                  <th className="p-3.5 text-left">สถานะ</th>
                  <th className="p-3.5 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {data.academicYears.map((ay) => (
                  <tr key={ay.id} className="border-b border-slate-100 last:border-b-0 hover:bg-white/60">
                    <td className="p-3.5 font-mono font-semibold">{ay.year}</td>
                    <td className="p-3.5 font-mono">{ay.semester}</td>
                    <td className="p-3.5 tabular-nums">{ay.daysOfWeek.length} วัน</td>
                    <td className="p-3.5">
                      {ay.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          ภาคเรียนปัจจุบัน
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">ภาคเรียนอื่น</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      {!ay.isActive && canEdit && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await activateSingleAcademicYear(ay.id, ay.year, ay.semester);
                              showToast(`ตั้งปีการศึกษา ${ay.year}/${ay.semester} เป็นภาคเรียนปัจจุบันแล้ว`, 'success');
                            } catch (err) {
                              showToast(formatErrorMessage(err), 'error');
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg border text-xs font-semibold bg-white hover:bg-slate-50 whitespace-nowrap"
                          style={{ borderColor: theme.border, color: theme.primary }}
                        >
                          ตั้งเป็นปัจจุบัน
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => openEdit(ay as unknown as Record<string, unknown>)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-35 rounded-lg hover:bg-slate-100"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl border max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {editingId ? 'แก้ไขข้อมูล' : 'เพิ่มข้อมูลใหม่'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {tab === 'teachers' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">รหัสครู *</label>
                  <input
                    required
                    value={String(fields.code || '')}
                    onChange={(e) => setFields({ ...fields, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ชั่วโมงสูงสุด/สัปดาห์ *</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    required
                    value={Number(fields.maxHoursPerWeek || 20)}
                    onChange={(e) => setFields({ ...fields, maxHoursPerWeek: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อ *</label>
                  <input
                    required
                    value={String(fields.firstName || '')}
                    onChange={(e) => setFields({ ...fields, firstName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">นามสกุล *</label>
                  <input
                    required
                    value={String(fields.lastName || '')}
                    onChange={(e) => setFields({ ...fields, lastName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">กลุ่มสาระ</label>
                  <select
                    value={String(fields.departmentId || '')}
                    onChange={(e) => setFields({ ...fields, departmentId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="">ไม่ระบุ</option>
                    {data.departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ตำแหน่ง</label>
                  <input
                    value={String(fields.position || '')}
                    onChange={(e) => setFields({ ...fields, position: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>
            )}

            {tab === 'subjects' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">รหัสวิชา *</label>
                  <input
                    required
                    value={String(fields.code || '')}
                    onChange={(e) => setFields({ ...fields, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ระดับชั้น *</label>
                  <input
                    required
                    value={String(fields.gradeLevel || '')}
                    onChange={(e) => setFields({ ...fields, gradeLevel: e.target.value })}
                    placeholder="ม.1"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อรายวิชา *</label>
                  <input
                    required
                    value={String(fields.name || '')}
                    onChange={(e) => setFields({ ...fields, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">หน่วยกิต</label>
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    max={20}
                    value={Number(fields.credits || 1)}
                    onChange={(e) => setFields({ ...fields, credits: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ชั่วโมง/สัปดาห์ *</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    required
                    value={Number(fields.hoursPerWeek || 2)}
                    onChange={(e) => setFields({ ...fields, hoursPerWeek: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ครูผู้สอนหลัก</label>
                  <select
                    value={String(fields.defaultTeacherId || '')}
                    onChange={(e) => setFields({ ...fields, defaultTeacherId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="">เลือกครูผู้สอน</option>
                    {data.teachers.map((t) => (
                      <option key={t.id} value={t.id}>{t.code} {t.firstName} {t.lastName}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">สีการ์ดวิชาในตารางสอน (พาสเทล)</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {PASTEL_SWATCHES.map((swatch) => (
                      <button
                        key={swatch}
                        type="button"
                        onClick={() => setFields({ ...fields, color: swatch })}
                        className={`w-7 h-7 rounded-lg border-2 transition-transform ${
                          String(fields.color || '#4A7BD0').toUpperCase() === swatch.toUpperCase()
                            ? 'scale-110 border-slate-900'
                            : 'border-white shadow-xs'
                        }`}
                        style={{ backgroundColor: swatch }}
                        title={swatch}
                      />
                    ))}
                    <input
                      type="color"
                      value={String(fields.color || '#4A7BD0')}
                      onChange={(e) => setFields({ ...fields, color: e.target.value })}
                      className="w-9 h-7 rounded-lg border border-slate-300 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {tab === 'classrooms' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อชั้นเรียน *</label>
                  <input
                    required
                    placeholder="ม.1/1"
                    value={String(fields.name || '')}
                    onChange={(e) => setFields({ ...fields, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ระดับชั้น *</label>
                  <input
                    required
                    placeholder="ม.1"
                    value={String(fields.gradeLevel || '')}
                    onChange={(e) => setFields({ ...fields, gradeLevel: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ครูประจำชั้น</label>
                  <select
                    value={String(fields.homeroomTeacherId || '')}
                    onChange={(e) => setFields({ ...fields, homeroomTeacherId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="">ไม่ระบุ</option>
                    {data.teachers.map((t) => (
                      <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">จำนวนนักเรียน</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={Number(fields.studentCount || 35)}
                    onChange={(e) => setFields({ ...fields, studentCount: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>
            )}

            {tab === 'rooms' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">รหัสห้อง *</label>
                  <input
                    required
                    placeholder="R101"
                    value={String(fields.code || '')}
                    onChange={(e) => setFields({ ...fields, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อห้อง *</label>
                  <input
                    required
                    placeholder="ห้องเรียน ม.1/1"
                    value={String(fields.name || '')}
                    onChange={(e) => setFields({ ...fields, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">อาคาร</label>
                  <input
                    value={String(fields.building || '')}
                    onChange={(e) => setFields({ ...fields, building: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ชั้น</label>
                  <input
                    value={String(fields.floor || '')}
                    onChange={(e) => setFields({ ...fields, floor: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ประเภทห้อง *</label>
                  <input
                    required
                    value={String(fields.roomType || '')}
                    onChange={(e) => setFields({ ...fields, roomType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ความจุ *</label>
                  <input
                    type="number"
                    min={1}
                    max={2000}
                    required
                    value={Number(fields.capacity || 40)}
                    onChange={(e) => setFields({ ...fields, capacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>
            )}

            {tab === 'departments' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">รหัสกลุ่มสาระ</label>
                  <input
                    value={String(fields.code || '')}
                    onChange={(e) => setFields({ ...fields, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">สีประจำกลุ่ม</label>
                  <input
                    type="color"
                    value={String(fields.color || '#4A7BD0')}
                    onChange={(e) => setFields({ ...fields, color: e.target.value })}
                    className="w-full h-10 rounded-xl border border-slate-300 cursor-pointer"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อกลุ่มสาระการเรียนรู้ *</label>
                  <input
                    required
                    value={String(fields.name || '')}
                    onChange={(e) => setFields({ ...fields, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>
            )}

            {tab === 'timeSlots' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ลำดับคาบ *</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={Number(fields.periodNumber || 1)}
                    onChange={(e) => setFields({ ...fields, periodNumber: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อคาบ *</label>
                  <input
                    required
                    value={String(fields.label || '')}
                    onChange={(e) => setFields({ ...fields, label: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">เวลาเริ่มต้น *</label>
                  <input
                    required
                    value={String(fields.startTime || '')}
                    onChange={(e) => setFields({ ...fields, startTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">เวลาสิ้นสุด *</label>
                  <input
                    required
                    value={String(fields.endTime || '')}
                    onChange={(e) => setFields({ ...fields, endTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                  />
                </div>
                <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700 pt-1">
                  <input
                    type="checkbox"
                    checked={Boolean(fields.isBreak)}
                    onChange={(e) => setFields({ ...fields, isBreak: e.target.checked })}
                  />
                  <span>กำหนดเป็นคาบพักกลางวัน / พักเบรก</span>
                </label>
              </div>
            )}

            {tab === 'academicYears' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ปีการศึกษา *</label>
                  <input
                    required
                    value={String(fields.year || '')}
                    onChange={(e) => setFields({ ...fields, year: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ภาคเรียน *</label>
                  <input
                    required
                    value={String(fields.semester || '')}
                    onChange={(e) => setFields({ ...fields, semester: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(fields.isActive)}
                    onChange={(e) => setFields({ ...fields, isActive: e.target.checked })}
                  />
                  <span>ตั้งเป็นภาคเรียนที่ใช้งานปัจจุบัน</span>
                </label>
              </div>
            )}

            <div className="pt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-white rounded-xl disabled:opacity-50 hover:opacity-95"
                style={{
                  background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                }}
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </form>
        </div>
      )}
    </WorkspaceShell>
  );
}
