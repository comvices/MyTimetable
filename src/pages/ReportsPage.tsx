import React, { useMemo, useState } from 'react';
import { Archive, CheckCircle2, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { WorkspaceShell } from '../components/layout/WorkspaceShell';
import { useTenant } from '../contexts/TenantContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useSchoolWorkspace } from '../hooks/useSchoolWorkspace';
import { formatErrorMessage } from '../lib/firestoreError';
import {
  buildReportSpecs,
  generateAllReportsZip,
  generateExcelBuffer,
  generatePdfBlob,
  ReportKind,
  triggerDownload,
} from '../services/exportService';

const REPORT_OPTIONS: Array<{ id: ReportKind; label: string; desc: string }> = [
  { id: 'all_teachers', label: '1. ตารางสอนครูทุกคน', desc: 'รวมตารางสอนของครูทั้งโรงเรียน' },
  { id: 'single_teacher', label: '2. ตารางสอนครูรายบุคคล', desc: 'เลือกพิมพ์เฉพาะครูที่ต้องการ' },
  { id: 'all_classrooms', label: '3. ตารางเรียนทุกชั้น', desc: 'ตารางเรียนของทุกห้องเรียน/ชั้นเรียน' },
  { id: 'single_classroom', label: '4. ตารางเรียนรายห้อง', desc: 'เลือกเฉพาะชั้นเรียนที่ต้องการ' },
  { id: 'all_rooms', label: '5. ตารางใช้ห้องทุกห้อง', desc: 'ตรวจสอบการใช้ห้องปฏิบัติการและห้องเรียน' },
  { id: 'single_room', label: '6. ตารางใช้ห้องรายห้อง', desc: 'เลือกเฉพาะห้องที่ต้องการ' },
  { id: 'teacher_workload', label: '7. รายงานภาระงานครู', desc: 'สรุปชั่วโมงสอน คาบว่าง และรายวิชาของครูทุกคน' },
];

export function ReportsPage() {
  const { school, hasFeature } = useTenant();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const data = useSchoolWorkspace();

  const [reportKind, setReportKind] = useState<ReportKind>('all_classrooms');
  const [targetId, setTargetId] = useState<string>('');
  const [exporting, setExporting] = useState(false);

  const activeYear = useMemo(
    () => data.academicYears.find((y) => y.isActive) || data.academicYears[0],
    [data.academicYears]
  );

  const exportDataset = useMemo(() => {
    if (!school) return null;
    const yearEntries = activeYear
      ? data.timetables.filter((e) => e.academicYearId === activeYear.id)
      : data.timetables;
    const yearActivities = activeYear
      ? data.activities.filter((a) => a.academicYearId === activeYear.id)
      : data.activities;

    return {
      school,
      academicLabel: activeYear
        ? `ปีการศึกษา ${activeYear.year} ภาคเรียนที่ ${activeYear.semester}`
        : 'ปีการศึกษาปัจจุบัน',
      entries: yearEntries,
      activities: yearActivities,
      teachers: data.teachers,
      subjects: data.subjects,
      classrooms: data.classrooms,
      rooms: data.rooms,
      timeSlots: data.timeSlots,
      daysOfWeek: activeYear?.daysOfWeek || [1, 2, 3, 4, 5],
    };
  }, [school, activeYear, data]);

  const previewSpec = useMemo(() => {
    if (!exportDataset) return null;
    return buildReportSpecs(reportKind, exportDataset, targetId);
  }, [exportDataset, reportKind, targetId]);

  if (!school || !exportDataset) {
    return (
      <WorkspaceShell title="รายงานและส่งออกเอกสาร">
        <div
          className="p-8 pastel-glass rounded-2xl border text-sm text-slate-500"
          style={{ borderColor: theme.border }}
        >
          กำลังโหลด...
        </div>
      </WorkspaceShell>
    );
  }

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const blob = await generatePdfBlob(reportKind, exportDataset, targetId);
      triggerDownload(blob, `${school.slug}_${reportKind}.pdf`);
      showToast('ส่งออกไฟล์ PDF พร้อมโลโก้โรงเรียนสำเร็จ', 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = () => {
    try {
      const buf = generateExcelBuffer(reportKind, exportDataset, targetId);
      triggerDownload(
        buf,
        `${school.slug}_${reportKind}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      showToast('ส่งออกไฟล์ Excel (.xlsx) สำเร็จ', 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    }
  };

  const handleExportZip = async () => {
    if (!hasFeature('zip_export')) {
      showToast('ดาวน์โหลดรวม ZIP พร้อมใช้งานตั้งแต่แพ็กเกจ Professional ขึ้นไป', 'warning');
      return;
    }
    setExporting(true);
    try {
      const blob = await generateAllReportsZip(exportDataset);
      triggerDownload(blob, `${school.slug}_all_reports.zip`);
      showToast('ส่งออกชุดรายงานรวมไฟล์ ZIP (PDF + Excel) สำเร็จ', 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <WorkspaceShell
      title="รายงานและส่งออกเอกสาร (PDF / Excel / ZIP)"
      breadcrumb={`${school.nameTh} · ${exportDataset.academicLabel}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleExportPdf()}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-xl shadow-xs whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            <span>ส่งออก PDF</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>ส่งออก Excel</span>
          </button>
          <button
            type="button"
            onClick={() => void handleExportZip()}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-white text-xs font-semibold rounded-xl shadow-xs hover:opacity-95 whitespace-nowrap shrink-0 disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
            }}
          >
            <Archive className="w-4 h-4" />
            <span>ดาวน์โหลดรวม ZIP</span>
          </button>
        </div>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6"
      >
        {/* Left Report Selector */}
        <div className="lg:col-span-4 space-y-2.5">
          {REPORT_OPTIONS.map((opt) => {
            const active = reportKind === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setReportKind(opt.id);
                  setTargetId('');
                }}
                className="w-full text-left p-4 rounded-2xl border transition-all pastel-card-hover pastel-glass"
                style={{
                  borderColor: active ? theme.primary : theme.border,
                  backgroundColor: active ? theme.pastelSoft : undefined,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-bold text-slate-900">{opt.label}</div>
                  {active && (
                    <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: theme.primary }} />
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1">{opt.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Right Live Preview */}
        <div
          className="lg:col-span-8 pastel-glass border rounded-2xl overflow-hidden"
          style={{ borderColor: theme.border }}
        >
          <div
            className="p-5 border-b flex flex-wrap items-center justify-between gap-3"
            style={{ borderColor: theme.border, backgroundColor: theme.pastelSoft }}
          >
            <div className="flex items-center gap-3">
              {school.logoUrl && (
                <img
                  src={school.logoUrl}
                  alt={school.nameTh}
                  className="w-10 h-10 rounded-xl object-contain border border-slate-200 bg-white p-0.5"
                />
              )}
              <div>
                <div className="text-sm font-bold text-slate-900">{school.nameTh}</div>
                <div className="text-xs text-slate-600">
                  {previewSpec?.reportTitle} · {exportDataset.academicLabel}
                </div>
              </div>
            </div>

            {reportKind === 'single_teacher' && (
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="px-3 py-2 rounded-xl border text-xs bg-white font-medium"
                style={{ borderColor: theme.border }}
              >
                {data.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} {t.firstName} {t.lastName}
                  </option>
                ))}
              </select>
            )}

            {reportKind === 'single_classroom' && (
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="px-3 py-2 rounded-xl border text-xs bg-white font-medium"
                style={{ borderColor: theme.border }}
              >
                {data.classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            {reportKind === 'single_room' && (
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="px-3 py-2 rounded-xl border text-xs bg-white font-medium"
                style={{ borderColor: theme.border }}
              >
                {data.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} {r.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="p-5 space-y-6 max-h-[680px] overflow-y-auto">
            {!previewSpec || previewSpec.tables.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                <Download className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                ยังไม่มีข้อมูลสำหรับรายงานนี้
              </div>
            ) : (
              previewSpec.tables.slice(0, 4).map((table, i) => (
                <div key={i} className="space-y-2">
                  <div className="text-xs font-bold text-slate-800">{table.subtitle}</div>
                  <div
                    className="overflow-x-auto border rounded-xl bg-white/90"
                    style={{ borderColor: theme.border }}
                  >
                    <table className="w-full text-[11px] border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {table.headers.map((h, idx) => (
                            <th
                              key={idx}
                              className="p-2 text-left font-semibold text-slate-700 border-r border-slate-200 last:border-r-0 whitespace-pre-line"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {table.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="border-b border-slate-100 last:border-b-0">
                            {row.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className="p-2 align-top border-r border-slate-100 last:border-r-0 whitespace-pre-line text-slate-700"
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </WorkspaceShell>
  );
}
