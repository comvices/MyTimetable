import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { School } from '../types/saas';
import {
  ActivityLock,
  Classroom,
  DAY_LABELS_TH,
  Room,
  Subject,
  Teacher,
  TimeSlot,
  TimetableEntry,
} from '../types/school';

export interface ExportDataset {
  school: School;
  academicLabel: string;
  entries: TimetableEntry[];
  activities: ActivityLock[];
  teachers: Teacher[];
  subjects: Subject[];
  classrooms: Classroom[];
  rooms: Room[];
  timeSlots: TimeSlot[];
  daysOfWeek: number[];
}

export type ReportKind =
  | 'all_teachers'
  | 'single_teacher'
  | 'all_classrooms'
  | 'single_classroom'
  | 'all_rooms'
  | 'single_room'
  | 'teacher_workload';

interface MatrixTableSpec {
  subtitle: string;
  headers: string[];
  rows: string[][];
}

function buildMatrixForFilter(
  title: string,
  data: ExportDataset,
  filterFn: (entry: TimetableEntry) => boolean,
  cellFormatter: (entry: TimetableEntry) => string,
  activityMatcher?: (act: ActivityLock) => boolean
): MatrixTableSpec {
  const sortedSlots = [...data.timeSlots].sort((a, b) => a.periodNumber - b.periodNumber);
  const headers = [
    'วัน / คาบ',
    ...sortedSlots.map((s) => `${s.label}\n(${s.startTime}-${s.endTime})`),
  ];

  const rows = data.daysOfWeek.map((day) => {
    const row: string[] = [DAY_LABELS_TH[day] || `วันที่ ${day}`];
    for (const slot of sortedSlots) {
      if (slot.isBreak) {
        row.push('พัก');
        continue;
      }
      const matched = data.entries.filter(
        (e) => e.dayOfWeek === day && e.periodNumber === slot.periodNumber && filterFn(e)
      );
      if (matched.length > 0) {
        row.push(matched.map(cellFormatter).join('\n'));
      } else if (activityMatcher) {
        const act = data.activities.find(
          (a) => a.dayOfWeek === day && a.periodNumber === slot.periodNumber && activityMatcher(a)
        );
        row.push(act ? `[กิจกรรม] ${act.name}` : '-');
      } else {
        row.push('-');
      }
    }
    return row;
  });

  return { subtitle: title, headers, rows };
}

export function buildReportSpecs(
  kind: ReportKind,
  data: ExportDataset,
  targetId?: string
): { reportTitle: string; tables: MatrixTableSpec[] } {
  const subjMap = new Map(data.subjects.map((s) => [s.id, s]));
  const teacherMap = new Map(data.teachers.map((t) => [t.id, t]));
  const roomMap = new Map(data.rooms.map((r) => [r.id, r]));
  const classMap = new Map(data.classrooms.map((c) => [c.id, c]));

  const formatForTeacher = (e: TimetableEntry) => {
    const s = subjMap.get(e.subjectId);
    const c = classMap.get(e.classroomId);
    const r = roomMap.get(e.roomId);
    return `${s?.code || ''} ${s?.name || ''}\n${c?.name || ''} · ${r?.code || '-'}`;
  };

  const formatForClassroom = (e: TimetableEntry) => {
    const s = subjMap.get(e.subjectId);
    const t = teacherMap.get(e.teacherId);
    const r = roomMap.get(e.roomId);
    return `${s?.code || ''} ${s?.name || ''}\n${t ? `${t.firstName} ${t.lastName}` : ''} · ${r?.code || '-'}`;
  };

  const formatForRoom = (e: TimetableEntry) => {
    const s = subjMap.get(e.subjectId);
    const c = classMap.get(e.classroomId);
    const t = teacherMap.get(e.teacherId);
    return `${c?.name || ''} (${s?.code || ''})\n${t ? `${t.firstName}` : ''}`;
  };

  if (kind === 'single_teacher') {
    const t = data.teachers.find((item) => item.id === targetId) || data.teachers[0];
    if (!t) return { reportTitle: 'ตารางสอนครูรายบุคคล', tables: [] };
    return {
      reportTitle: `ตารางสอนครู: ${t.firstName} ${t.lastName} (${t.code})`,
      tables: [
        buildMatrixForFilter(
          `ครูผู้สอน: ${t.firstName} ${t.lastName} · ภาระงานสูงสุด ${t.maxHoursPerWeek} ชม./สัปดาห์`,
          data,
          (e) => e.teacherId === t.id,
          formatForTeacher
        ),
      ],
    };
  }

  if (kind === 'all_teachers') {
    return {
      reportTitle: 'ตารางสอนครูทุกคน',
      tables: data.teachers.map((t) =>
        buildMatrixForFilter(
          `ครู ${t.firstName} ${t.lastName} (${t.code})`,
          data,
          (e) => e.teacherId === t.id,
          formatForTeacher
        )
      ),
    };
  }

  if (kind === 'single_classroom') {
    const c = data.classrooms.find((item) => item.id === targetId) || data.classrooms[0];
    if (!c) return { reportTitle: 'ตารางเรียนรายห้อง', tables: [] };
    return {
      reportTitle: `ตารางเรียนชั้น ${c.name}`,
      tables: [
        buildMatrixForFilter(
          `ชั้นเรียน ${c.name} (${c.gradeLevel})`,
          data,
          (e) => e.classroomId === c.id,
          formatForClassroom,
          (act) =>
            act.scope === 'whole_school' ||
            (act.scope === 'grade_level' && act.targetGradeLevel === c.gradeLevel) ||
            (act.scope === 'classroom' && act.targetClassroomId === c.id)
        ),
      ],
    };
  }

  if (kind === 'all_classrooms') {
    return {
      reportTitle: 'ตารางเรียนทุกชั้นเรียน',
      tables: data.classrooms.map((c) =>
        buildMatrixForFilter(
          `ชั้นเรียน ${c.name} (${c.gradeLevel})`,
          data,
          (e) => e.classroomId === c.id,
          formatForClassroom,
          (act) =>
            act.scope === 'whole_school' ||
            (act.scope === 'grade_level' && act.targetGradeLevel === c.gradeLevel) ||
            (act.scope === 'classroom' && act.targetClassroomId === c.id)
        )
      ),
    };
  }

  if (kind === 'single_room') {
    const r = data.rooms.find((item) => item.id === targetId) || data.rooms[0];
    if (!r) return { reportTitle: 'ตารางใช้ห้องรายห้อง', tables: [] };
    return {
      reportTitle: `ตารางการใช้ห้อง ${r.code} — ${r.name}`,
      tables: [
        buildMatrixForFilter(
          `ห้อง ${r.code} ${r.name} (${r.building || '-'}) ความจุ ${r.capacity} คน`,
          data,
          (e) => e.roomId === r.id,
          formatForRoom,
          (act) => act.roomId === r.id
        ),
      ],
    };
  }

  if (kind === 'all_rooms') {
    return {
      reportTitle: 'ตารางการใช้ห้องทุกห้อง',
      tables: data.rooms.map((r) =>
        buildMatrixForFilter(
          `ห้อง ${r.code} ${r.name}`,
          data,
          (e) => e.roomId === r.id,
          formatForRoom,
          (act) => act.roomId === r.id
        )
      ),
    };
  }

  // teacher_workload
  const teachableCount = data.timeSlots.filter((s) => !s.isBreak).length * data.daysOfWeek.length;
  const rows = data.teachers.map((t) => {
    const assigned = data.entries.filter((e) => e.teacherId === t.id);
    const uniqueSubjects = new Set(assigned.map((e) => subjMap.get(e.subjectId)?.name || e.subjectId));
    const uniqueClasses = new Set(assigned.map((e) => classMap.get(e.classroomId)?.name || e.classroomId));
    const freeSlots = Math.max(0, teachableCount - assigned.length);
    return [
      t.code,
      `${t.firstName} ${t.lastName}`,
      t.position || 'ครูผู้สอน',
      String(assigned.length),
      String(t.maxHoursPerWeek),
      String(freeSlots),
      Array.from(uniqueSubjects).join(', ') || '-',
      Array.from(uniqueClasses).join(', ') || '-',
    ];
  });

  return {
    reportTitle: 'รายงานภาระงานสอนของครู',
    tables: [
      {
        subtitle: `สรุปภาระงานครูทั้งหมด ${data.teachers.length} คน (${data.academicLabel})`,
        headers: [
          'รหัสครู',
          'ชื่อ-นามสกุล',
          'ตำแหน่ง',
          'คาบที่สอน',
          'สูงสุด/สัปดาห์',
          'คาบว่าง',
          'รายวิชาที่สอน',
          'ชั้นเรียน',
        ],
        rows,
      },
    ],
  };
}

async function loadImageElement(src?: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const lines = text.split('\n');
  let offsetY = 0;
  for (const rawLine of lines) {
    let line = rawLine;
    while (line.length > 0 && ctx.measureText(line).width > maxWidth) {
      let cut = line.length;
      while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) {
        cut--;
      }
      ctx.fillText(line.slice(0, cut), x, y + offsetY);
      line = line.slice(cut);
      offsetY += lineHeight;
    }
    ctx.fillText(line, x, y + offsetY);
    offsetY += lineHeight;
  }
}

export async function generatePdfBlob(
  kind: ReportKind,
  data: ExportDataset,
  targetId?: string
): Promise<Blob> {
  const { reportTitle, tables } = buildReportSpecs(kind, data, targetId);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logoImg = await loadImageElement(data.school.logoUrl);

  const pageTables = tables.length > 0 ? tables : [{ subtitle: 'ไม่พบข้อมูล', headers: ['สถานะ'], rows: [['ยังไม่มีข้อมูลในระบบ']] }];

  pageTables.forEach((table, idx) => {
    if (idx > 0) pdf.addPage();

    const canvas = document.createElement('canvas');
    canvas.width = 1754; // Crisp A4 Landscape @150dpi
    canvas.height = 1240;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header band with school brand color
    const brandColor = data.school.primaryColor || '#0f3d75';
    ctx.fillStyle = brandColor;
    ctx.fillRect(0, 0, canvas.width, 130);

    // School Logo
    let textStartX = 64;
    if (logoImg) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(56, 20, 90, 90, 12);
      ctx.fill();
      ctx.drawImage(logoImg, 62, 26, 78, 78);
      textStartX = 168;
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px "Noto Sans Thai", sans-serif';
    ctx.fillText(data.school.nameTh, textStartX, 62);
    ctx.font = '500 22px "Noto Sans Thai", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillText(`${reportTitle}  |  ${data.academicLabel}`, textStartX, 100);

    // Subtitle
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px "Noto Sans Thai", sans-serif';
    ctx.fillText(table.subtitle, 56, 178);

    // Draw Table
    const startX = 56;
    const startY = 204;
    const totalW = canvas.width - 112;
    const colCount = Math.max(1, table.headers.length);
    const colW = totalW / colCount;
    const headerH = 66;
    const rowH = Math.min(130, Math.floor((canvas.height - startY - headerH - 70) / Math.max(1, table.rows.length)));

    // Table Header
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(startX, startY, totalW, headerH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(startX, startY, totalW, headerH);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 17px "Noto Sans Thai", sans-serif';
    table.headers.forEach((h, cIdx) => {
      const cellX = startX + cIdx * colW;
      ctx.strokeRect(cellX, startY, colW, headerH);
      drawWrappedText(ctx, h, cellX + 10, startY + 26, colW - 20, 22);
    });

    // Table Rows
    ctx.font = '400 15px "Noto Sans Thai", sans-serif';
    table.rows.slice(0, 12).forEach((row, rIdx) => {
      const y = startY + headerH + rIdx * rowH;
      ctx.fillStyle = rIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(startX, y, totalW, rowH);
      row.forEach((cell, cIdx) => {
        const cellX = startX + cIdx * colW;
        ctx.strokeStyle = '#cbd5e1';
        ctx.strokeRect(cellX, y, colW, rowH);
        ctx.fillStyle = cIdx === 0 ? '#0f172a' : '#334155';
        drawWrappedText(ctx, cell || '-', cellX + 10, y + 26, colW - 20, 20);
      });
    });

    // Footer
    ctx.fillStyle = '#64748b';
    ctx.font = '400 15px "Noto Sans Thai", sans-serif';
    ctx.fillText(
      `จัดทำโดย ${data.school.nameTh} · พิมพ์เมื่อ ${new Date().toLocaleDateString('th-TH')}`,
      56,
      canvas.height - 28
    );

    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
  });

  return pdf.output('blob');
}

export function generateExcelBuffer(
  kind: ReportKind,
  data: ExportDataset,
  targetId?: string
): ArrayBuffer {
  const { reportTitle, tables } = buildReportSpecs(kind, data, targetId);
  const wb = XLSX.utils.book_new();

  if (tables.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([[data.school.nameTh], [reportTitle], ['ไม่พบข้อมูล']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
  } else {
    tables.forEach((table, idx) => {
      const sheetRows = [
        [data.school.nameTh, data.school.nameEn || '', data.academicLabel],
        [table.subtitle],
        [],
        table.headers.map((h) => h.replace(/\n/g, ' ')),
        ...table.rows.map((r) => r.map((c) => c.replace(/\n/g, ' | '))),
      ];
      const ws = XLSX.utils.aoa_to_sheet(sheetRows);
      const rawName = table.subtitle.replace(/[\\/*?:[\]]/g, '').slice(0, 26) || `Sheet_${idx + 1}`;
      const sheetName = `${idx + 1}_${rawName}`.slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
  }

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

export async function generateAllReportsZip(data: ExportDataset): Promise<Blob> {
  const zip = new JSZip();
  const kinds: Array<{ kind: ReportKind; file: string }> = [
    { kind: 'all_teachers', file: '01_ตารางสอนครูทุกคน' },
    { kind: 'all_classrooms', file: '02_ตารางเรียนทุกชั้น' },
    { kind: 'all_rooms', file: '03_ตารางใช้ห้องทุกห้อง' },
    { kind: 'teacher_workload', file: '04_รายงานภาระงานครู' },
  ];

  for (const item of kinds) {
    const xlsxBuf = generateExcelBuffer(item.kind, data);
    zip.file(`${item.file}.xlsx`, xlsxBuf);

    const pdfBlob = await generatePdfBlob(item.kind, data);
    zip.file(`${item.file}.pdf`, pdfBlob);
  }

  return zip.generateAsync({ type: 'blob' });
}

export function triggerDownload(blobOrBuffer: Blob | ArrayBuffer, filename: string, mime?: string) {
  const blob =
    blobOrBuffer instanceof Blob
      ? blobOrBuffer
      : new Blob([blobOrBuffer], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
