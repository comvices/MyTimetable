import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Lock, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { WorkspaceShell } from '../components/layout/WorkspaceShell';
import { useTenant } from '../contexts/TenantContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useSchoolWorkspace } from '../hooks/useSchoolWorkspace';
import { formatErrorMessage } from '../lib/firestoreError';
import { generateId } from '../lib/tenant';
import { deleteSchoolDoc, upsertSchoolDoc } from '../services/schoolService';
import { ActivityScope, DAY_LABELS_TH } from '../types/school';

const ACTIVITY_CATEGORIES = [
  'ลูกเสือและเนตรนารี',
  'ชุมนุม',
  'แนะแนว',
  'กิจกรรมคุณธรรม',
  'กิจกรรมพิเศษ',
];

export function ActivitiesLockPage() {
  const { school, effectiveSchoolRole, hasFeature, isReadOnly } = useTenant();
  const { theme } = useTheme();
  const { showToast, confirmAction } = useToast();
  const data = useSchoolWorkspace();

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: 'ลูกเสือและเนตรนารี',
    category: 'ลูกเสือและเนตรนารี',
    scope: 'whole_school' as ActivityScope,
    targetGradeLevel: '',
    targetClassroomId: '',
    dayOfWeek: 3,
    periodNumber: 7,
    venue: 'สนามโรงเรียน',
    roomId: '',
  });

  const activeYear = useMemo(
    () => data.academicYears.find((y) => y.isActive) || data.academicYears[0],
    [data.academicYears]
  );

  const canUseLock = hasFeature('activity_lock');
  const canEdit = !isReadOnly && effectiveSchoolRole !== 'teacher' && canUseLock;

  const gradeLevels = Array.from(new Set(data.classrooms.map((c) => c.gradeLevel)));
  const roomMap = new Map(data.rooms.map((r) => [r.id, r]));
  const classMap = new Map(data.classrooms.map((c) => [c.id, c]));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school || !activeYear || !canEdit) return;
    setSaving(true);
    try {
      const id = generateId('act');
      await upsertSchoolDoc(
        school.id,
        'activities',
        id,
        {
          academicYearId: activeYear.id,
          name: form.name.trim(),
          category: form.category,
          scope: form.scope,
          targetGradeLevel: form.scope === 'grade_level' ? form.targetGradeLevel : '',
          targetClassroomId: form.scope === 'classroom' ? form.targetClassroomId : '',
          dayOfWeek: Number(form.dayOfWeek),
          periodNumber: Number(form.periodNumber),
          venue: form.venue.trim(),
          roomId: form.roomId,
        },
        true
      );
      setModalOpen(false);
      showToast('บันทึกการล็อกคาบกิจกรรมเรียบร้อยแล้ว', 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!school || !canEdit) return;
    const ok = await confirmAction({
      title: 'ปลดล็อกคาบกิจกรรม?',
      description: `ต้องการลบการล็อกกิจกรรม "${name}" ออกจากระบบหรือไม่`,
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteSchoolDoc(school.id, 'activities', id);
      showToast('ลบคาบกิจกรรมแล้ว', 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    }
  };

  return (
    <WorkspaceShell
      title="ล็อกคาบกิจกรรม (Global Activity Lock)"
      breadcrumb={school?.nameTh}
      actions={
        canEdit ? (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-white text-xs font-semibold rounded-xl shadow-xs hover:opacity-95 whitespace-nowrap shrink-0"
            style={{
              background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
            }}
          >
            <Plus className="w-4 h-4" />
            <span>ล็อกคาบกิจกรรมใหม่</span>
          </button>
        ) : null
      }
    >
      {!canUseLock ? (
        <div
          className="pastel-glass border rounded-2xl p-8 text-center max-w-xl mx-auto"
          style={{ borderColor: theme.border }}
        >
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">ฟีเจอร์ล็อกคาบกิจกรรมสำหรับแพ็กเกจ Professional ขึ้นไป</h2>
          <p className="text-sm text-slate-600 mt-2">
            อัปเกรดแพ็กเกจเพื่อใช้งานระบบล็อกคาบลูกเสือ ชุมนุม แนะแนว ทั้งโรงเรียน พร้อมตรวจจับการชนอัตโนมัติ
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
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="pastel-glass border rounded-2xl overflow-hidden"
          style={{ borderColor: theme.border }}
        >
          <div
            className="px-6 py-4 border-b flex items-center justify-between"
            style={{ borderColor: theme.border, backgroundColor: theme.pastelSoft }}
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <CalendarClock className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">รายการคาบกิจกรรมที่ล็อกเวลาไว้</h2>
                <p className="text-xs text-slate-600">
                  แยกการล็อกเวลาออกจากการจองห้องเรียน หากลงวิชาเรียนซ้อนในคาบเหล่านี้ระบบจะแจ้งเตือนทันที
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-lg bg-white/90 border border-slate-200 text-xs font-mono font-semibold text-slate-700 tabular-nums">
              {data.activities.length} กิจกรรม
            </span>
          </div>

          {data.activities.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              ยังไม่มีการล็อกคาบกิจกรรม กด "ล็อกคาบกิจกรรมใหม่" เพื่อเริ่มต้น
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-xs text-slate-600">
                  <tr>
                    <th className="p-3.5 text-left">ชื่อกิจกรรม</th>
                    <th className="p-3.5 text-left">ขอบเขต</th>
                    <th className="p-3.5 text-left">วัน / คาบ</th>
                    <th className="p-3.5 text-left">สถานที่ / ห้องที่จอง</th>
                    <th className="p-3.5 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.activities.map((act) => {
                    const scopeText =
                      act.scope === 'whole_school'
                        ? 'ทั้งโรงเรียน'
                        : act.scope === 'grade_level'
                        ? `ระดับชั้น ${act.targetGradeLevel}`
                        : `เฉพาะห้อง ${classMap.get(act.targetClassroomId || '')?.name || act.targetClassroomId}`;
                    const room = act.roomId ? roomMap.get(act.roomId) : null;
                    return (
                      <tr key={act.id} className="border-b border-slate-100 last:border-b-0 hover:bg-white/60">
                        <td className="p-3.5">
                          <div className="font-semibold text-slate-900">{act.name}</div>
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 border border-amber-200 text-amber-800">
                            {act.category}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-700">{scopeText}</td>
                        <td className="p-3.5 tabular-nums text-slate-700 font-medium">
                          วัน{DAY_LABELS_TH[act.dayOfWeek]} · คาบ {act.periodNumber}
                        </td>
                        <td className="p-3.5 text-slate-600">
                          {act.venue || '-'}
                          {room ? ` (จองห้อง ${room.code})` : ''}
                        </td>
                        <td className="p-3.5 text-right">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => void handleDelete(act.id, act.name)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl border max-w-lg w-full p-6 space-y-4 shadow-xl"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">ล็อกคาบกิจกรรมใหม่</h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">ประเภทกิจกรรม</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  {ACTIVITY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อกิจกรรม *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">รูปแบบการล็อก</label>
                <select
                  value={form.scope}
                  onChange={(e) => setForm({ ...form, scope: e.target.value as ActivityScope })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="whole_school">ทั้งโรงเรียน</option>
                  <option value="grade_level">เฉพาะระดับชั้น</option>
                  <option value="classroom">เฉพาะกลุ่มนักเรียน / ชั้นเรียน</option>
                </select>
              </div>

              {form.scope === 'grade_level' && (
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">เลือกระดับชั้น *</label>
                  <select
                    required
                    value={form.targetGradeLevel}
                    onChange={(e) => setForm({ ...form, targetGradeLevel: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="">เลือกระดับชั้น</option>
                    {gradeLevels.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              )}

              {form.scope === 'classroom' && (
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">เลือกชั้นเรียน *</label>
                  <select
                    required
                    value={form.targetClassroomId}
                    onChange={(e) => setForm({ ...form, targetClassroomId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="">เลือกชั้นเรียน</option>
                    {data.classrooms.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">วันเรียน</label>
                <select
                  value={form.dayOfWeek}
                  onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  {(activeYear?.daysOfWeek || [1, 2, 3, 4, 5]).map((d) => (
                    <option key={d} value={d}>{DAY_LABELS_TH[d]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">คาบเรียน</label>
                <select
                  value={form.periodNumber}
                  onChange={(e) => setForm({ ...form, periodNumber: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  {data.timeSlots
                    .filter((s) => !s.isBreak)
                    .map((s) => (
                      <option key={s.id} value={s.periodNumber}>
                        {s.label} ({s.startTime})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">สถานที่จัดกิจกรรม</label>
                <input
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  placeholder="สนาม / หอประชุม / ห้องเรียน"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">จองห้องในระบบ (ถ้ามี)</label>
                <select
                  value={form.roomId}
                  onChange={(e) => setForm({ ...form, roomId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="">ไม่จองห้องเรียน</option>
                  {data.rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.code} {r.name}</option>
                  ))}
                </select>
              </div>
            </div>

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
                {saving ? 'กำลังบันทึก...' : 'บันทึกการล็อก'}
              </button>
            </div>
          </form>
        </div>
      )}
    </WorkspaceShell>
  );
}
