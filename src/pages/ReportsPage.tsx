import React, { useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  ImagePlus,
  Printer,
  Trash2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { ImageCropModal } from '../components/branding/ImageCropModal';
import { WorkspaceShell } from '../components/layout/WorkspaceShell';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useSchoolWorkspace } from '../hooks/useSchoolWorkspace';
import { extractUsername } from '../lib/authIdentifier';
import { formatErrorMessage } from '../lib/firestoreError';
import {
  buildReportSpecs,
  generateAllReportsZip,
  generateExcelBuffer,
  generatePdfBlob,
  ReportKind,
  triggerDownload,
} from '../services/exportService';
import { updateSchoolProfileAndBranding, uploadBrandingAsset } from '../services/schoolService';

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
  const { currentUser } = useAuth();
  const { school, hasFeature, effectiveSchoolRole, isReadOnly, refreshTenant } = useTenant();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const data = useSchoolWorkspace();

  const [reportKind, setReportKind] = useState<ReportKind>('single_teacher');
  const [targetId, setTargetId] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [cropLogoFile, setCropLogoFile] = useState<File | null>(null);
  const [savingLogo, setSavingLogo] = useState(false);

  const canEditLogo =
    !isReadOnly && (effectiveSchoolRole === 'super_admin' || effectiveSchoolRole === 'school_admin');

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

    const semesterYearLabel = activeYear
      ? `ภาคเรียนที่ ${activeYear.semester}/${activeYear.year}`
      : school.semester && school.academicYear
      ? `ภาคเรียนที่ ${school.semester}/${school.academicYear}`
      : 'ภาคเรียนปัจจุบัน';

    return {
      school,
      academicLabel: activeYear
        ? `ปีการศึกษา ${activeYear.year} ภาคเรียนที่ ${activeYear.semester}`
        : 'ปีการศึกษาปัจจุบัน',
      semesterYearLabel,
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

  const handleSaveLogoBlob = async (blob: Blob) => {
    if (!currentUser || !canEditLogo) return;
    setSavingLogo(true);
    try {
      const logoUrl = await uploadBrandingAsset(school.id, 'logo', blob);
      await updateSchoolProfileAndBranding(
        school,
        { logoUrl },
        {
          uid: currentUser.uid,
          email: currentUser.email || '',
          username: currentUser.username || extractUsername(currentUser.email || ''),
          displayName: currentUser.displayName || currentUser.username || currentUser.email,
        }
      );
      await refreshTenant();
      setCropLogoFile(null);
      showToast('อัปโหลด Logo โรงเรียนสำหรับหัวตารางสอนเรียบร้อยแล้ว', 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setSavingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!currentUser || !canEditLogo) return;
    setSavingLogo(true);
    try {
      await updateSchoolProfileAndBranding(
        school,
        { logoUrl: '' },
        {
          uid: currentUser.uid,
          email: currentUser.email || '',
          username: currentUser.username || extractUsername(currentUser.email || ''),
          displayName: currentUser.displayName || currentUser.username || currentUser.email,
        }
      );
      await refreshTenant();
      showToast('นำ Logo โรงเรียนออกแล้ว', 'info');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setSavingLogo(false);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const blob = await generatePdfBlob(reportKind, exportDataset, targetId);
      triggerDownload(blob, `${school.slug}_${reportKind}_A4.pdf`);
      showToast('ส่งออกไฟล์ PDF (A4 แนวนอน แบบราชการ) สำเร็จ', 'success');
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
      title="รายงานและส่งออกเอกสารราชการ (A4 · Sarabun)"
      breadcrumb={`${school.nameTh} · ${exportDataset.academicLabel}`}
      actions={
        <div className="flex flex-wrap items-center gap-2 no-print">
          {canEditLogo && (
            <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold rounded-xl shadow-xs cursor-pointer whitespace-nowrap shrink-0">
              <ImagePlus className="w-4 h-4 text-slate-700" />
              <span>{school.logoUrl ? 'เปลี่ยน Logo โรงเรียน' : 'ใส่ Logo โรงเรียน'}</span>
              <input
                type="file"
                accept="image/*"
                disabled={savingLogo}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setCropLogoFile(file);
                  e.target.value = '';
                }}
              />
            </label>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-xs whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์ A4</span>
          </button>
          <button
            type="button"
            onClick={() => void handleExportPdf()}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-xl shadow-xs whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            <span>ส่งออก PDF (A4)</span>
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
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:block"
      >
        {/* Left Report Selector + Quick Logo Controls */}
        <div className="lg:col-span-3 space-y-3 no-print">
          <div
            className="pastel-glass border rounded-2xl p-4 space-y-2.5"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900">ตราสัญลักษณ์ (Logo) หัวตาราง</span>
              {school.logoUrl && canEditLogo && (
                <button
                  type="button"
                  disabled={savingLogo}
                  onClick={() => void handleRemoveLogo()}
                  className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:underline disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>ลบ</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                {school.logoUrl ? (
                  <img
                    src={school.logoUrl}
                    alt={school.nameTh}
                    className="w-12 h-12 object-contain"
                  />
                ) : (
                  <ImagePlus className="w-5 h-5 text-slate-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-slate-600">
                  แสดงมุมซ้ายบนของเอกสารตารางสอนขนาด A4 ทุกแผ่น
                </div>
                {canEditLogo && (
                  <label className="inline-block mt-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold cursor-pointer">
                    {school.logoUrl ? 'อัปโหลด Logo ใหม่' : 'เลือกไฟล์ Logo'}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={savingLogo}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setCropLogoFile(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
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
                  className="w-full text-left p-3.5 rounded-2xl border transition-all pastel-card-hover pastel-glass"
                  style={{
                    borderColor: active ? theme.primary : theme.border,
                    backgroundColor: active ? theme.pastelSoft : undefined,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-slate-900">{opt.label}</div>
                    {active && (
                      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: theme.primary }} />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Live Official A4 Preview */}
        <div
          className="lg:col-span-9 pastel-glass border rounded-2xl overflow-hidden print:border-0 print:rounded-none print:bg-transparent print:overflow-visible"
          style={{ borderColor: theme.border }}
        >
          <div
            className="p-4 border-b flex flex-wrap items-center justify-between gap-3 no-print"
            style={{ borderColor: theme.border, backgroundColor: theme.pastelSoft }}
          >
            <div>
              <div className="text-sm font-bold text-slate-900">
                ตัวอย่างเอกสารแบบราชการ (ขนาดกระดาษ A4 แนวนอน · ฟอนต์ Sarabun)
              </div>
              <div className="text-xs text-slate-600">
                {previewSpec?.reportTitle} · {exportDataset.academicLabel}
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

          <div className="p-4 sm:p-6 space-y-6 bg-slate-100/80 max-h-[780px] overflow-y-auto print:p-0 print:space-y-0 print:bg-white print:max-h-none print:overflow-visible">
            {!previewSpec || previewSpec.tables.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500 bg-white rounded-xl border border-slate-200">
                <Download className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                ยังไม่มีข้อมูลสำหรับรายงานนี้
              </div>
            ) : (
              <>
                {previewSpec.tables.length > 6 && (
                  <div className="no-print text-xs text-slate-600 bg-white/90 border border-slate-200 rounded-xl px-3 py-2 text-center">
                    กำลังแสดงตัวอย่าง 6 จากทั้งหมด {previewSpec.tables.length} แผ่น (กด &quot;พิมพ์ A4&quot; หรือ &quot;ส่งออก PDF (A4)&quot; เพื่อรับครบทุกแผ่น)
                  </div>
                )}
                {previewSpec.tables.map((table, i) => (
                  <div
                    key={i}
                    className={`print-a4-sheet font-sarabun bg-white border border-slate-300 shadow-sm mx-auto w-full max-w-[1040px] px-6 py-5 sm:px-8 sm:py-6 text-black ${
                      table.isMatrix ? 'aspect-[297/210] flex flex-col justify-between' : ''
                    } ${i >= 6 ? 'hidden print:flex' : ''}`}
                  >
                    {/* Official Header: Top-left School Logo + Centered Official Title */}
                    <div className="relative flex items-end justify-center mb-2 min-h-[58px] shrink-0">
                      {school.logoUrl && (
                        <img
                          src={school.logoUrl}
                          alt={school.nameTh}
                          className="w-14 h-14 object-contain absolute left-0 bottom-0"
                        />
                      )}
                      <div className="text-center font-bold text-base sm:text-lg leading-snug px-16">
                        {table.officialTitle}
                      </div>
                    </div>

                    {/* Official Grid */}
                    {table.isMatrix && table.periodNumbers.length > 0 ? (
                      <div className="overflow-x-auto flex-1 flex flex-col justify-center">
                      <table className="w-full border-collapse border-2 border-black text-center table-fixed">
                        <thead>
                          <tr>
                            <th className="border border-black py-1.5 px-1 font-bold text-xs sm:text-sm w-[10.5%] bg-white">
                              คาบที่
                            </th>
                            {table.periodNumbers.map((num, pIdx) => (
                              <th
                                key={pIdx}
                                className="border border-black py-1.5 px-1 font-normal text-xs sm:text-sm bg-white"
                              >
                                {num}
                              </th>
                            ))}
                          </tr>
                          <tr>
                            <th className="border border-black py-1.5 px-1 font-bold text-xs sm:text-sm bg-white">
                              เวลา
                            </th>
                            {table.periodTimes.map((timeRange, pIdx) => (
                              <th
                                key={pIdx}
                                className="border border-black py-1.5 px-0.5 font-normal text-[10px] sm:text-xs bg-white whitespace-nowrap tabular-nums"
                              >
                                {timeRange}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {table.rows.map((row, rIdx) => (
                            <tr key={rIdx}>
                              <td className="border border-black py-3 px-1 font-bold text-xs sm:text-sm align-middle bg-white">
                                {row[0]}
                              </td>
                              {row.slice(1).map((cell, cIdx) => (
                                <td
                                  key={cIdx}
                                  className="border border-black py-2 px-1 text-[11px] sm:text-xs leading-snug align-middle whitespace-pre-line bg-white h-16"
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border-2 border-black text-center">
                        <thead>
                          <tr>
                            {table.headers.map((h, idx) => (
                              <th
                                key={idx}
                                className="border border-black p-2 font-bold text-xs bg-white whitespace-pre-line"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {table.rows.map((row, rIdx) => (
                            <tr key={rIdx}>
                              {row.map((cell, cIdx) => (
                                <td
                                  key={cIdx}
                                  className="border border-black p-2 text-xs align-middle whitespace-pre-line bg-white"
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                    {/* Official Signature Footer */}
                    <div className="mt-4 pt-1 grid grid-cols-2 gap-4 text-center text-xs sm:text-sm font-medium text-black shrink-0">
                      <div>ลงชื่อ..............................................รองผู้อำนวยการ</div>
                      <div>ลงชื่อ..............................................ผู้อำนวยการ</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Crop Logo Modal */}
      {cropLogoFile && (
        <ImageCropModal
          file={cropLogoFile}
          title="ปรับตำแหน่ง Logo โรงเรียน (512 × 512 px)"
          targetWidth={512}
          targetHeight={512}
          outputMime="image/png"
          onConfirm={(blob) => void handleSaveLogoBlob(blob)}
          onCancel={() => setCropLogoFile(null)}
        />
      )}
    </WorkspaceShell>
  );
}
