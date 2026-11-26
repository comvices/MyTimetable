import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { School } from '../types/saas';
import {
  ActivityLock,
  Classroom,
  Room,
  Subject,
  Teacher,
  TimeSlot,
  TimetableEntry,
} from '../types/school';

export interface ExportDataset {
  school: School;
  academicLabel: string;
  semesterYearLabel?: string;
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

export interface MatrixTableSpec {
  subtitle: string;
  officialTitle: string;
  isMatrix: boolean;
  headers: string[];
  periodNumbers: string[];
  periodTimes: string[];
  rows: string[][];
}

const DAY_OFFICIAL_TH: Record<number, string> = {
  1: 'จันทร์',
  2: 'อังคาร',
  3: 'พุธ',
  4: 'พฤหัสฯ',
  5: 'ศุกร์',
  6: 'เสาร์',
  7: 'อาทิตย์',
};

function formatOfficialTimeRange(startTime: string, endTime: string): string {
  const s = (startTime || '').replace(/:/g, '.');
  const e = (endTime || '').replace(/:/g, '.');
  return `${s}-${e}`;
}

function buildMatrixForFilter(
  title: string,
  officialTitle: string,
  data: ExportDataset,
  filterFn: (entry: TimetableEntry) => boolean,
  cellFormatter: (entry: TimetableEntry) => string,
  activityMatcher?: (act: ActivityLock) => boolean
): MatrixTableSpec {
  const sortedSlots = [...data.timeSlots].sort((a, b) => a.periodNumber - b.periodNumber);
  const periodNumbers = sortedSlots.map((s) => String(s.periodNumber));
  const periodTimes = sortedSlots.map((s) => formatOfficialTimeRange(s.startTime, s.endTime));
  const headers = [
    'วัน / คาบ',
    ...sortedSlots.map((s) => `คาบ ${s.periodNumber}\n(${formatOfficialTimeRange(s.startTime, s.endTime)})`),
  ];

  const rows = data.daysOfWeek.map((day) => {
    const row: string[] = [DAY_OFFICIAL_TH[day] || `วันที่ ${day}`];
    for (const slot of sortedSlots) {
      if (slot.isBreak) {
        const label = (slot.label || 'พักเที่ยง').trim();
        row.push(label.includes('เที่ยง') ? `${label}\nโรงอาหาร` : label);
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
        if (act) {
          const lines = [act.name];
          if (act.venue) lines.push(act.venue);
          else if (act.category && act.category !== act.name) lines.push(act.category);
          row.push(lines.join('\n'));
        } else {
          row.push('');
        }
      } else {
        row.push('');
      }
    }
    return row;
  });

  return {
    subtitle: title,
    officialTitle,
    isMatrix: true,
    headers,
    periodNumbers,
    periodTimes,
    rows,
  };
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
  const termLabel = data.semesterYearLabel || data.academicLabel;

  const formatForTeacher = (e: TimetableEntry) => {
    const s = subjMap.get(e.subjectId);
    const c = classMap.get(e.classroomId);
    const r = roomMap.get(e.roomId);
    const lines = [s?.code || s?.name || ''];
    if (c?.name) lines.push(c.name);
    if (r?.code || r?.name) lines.push(r.code || r.name);
    return lines.filter(Boolean).join('\n');
  };

  const formatForClassroom = (e: TimetableEntry) => {
    const s = subjMap.get(e.subjectId);
    const t = teacherMap.get(e.teacherId);
    const r = roomMap.get(e.roomId);
    const lines = [s?.code || s?.name || ''];
    if (t) lines.push(`${t.firstName}`);
    if (r?.code || r?.name) lines.push(r.code || r.name);
    return lines.filter(Boolean).join('\n');
  };

  const formatForRoom = (e: TimetableEntry) => {
    const s = subjMap.get(e.subjectId);
    const c = classMap.get(e.classroomId);
    const t = teacherMap.get(e.teacherId);
    const lines = [c?.name || ''];
    if (s?.code) lines.push(s.code);
    if (t) lines.push(`${t.firstName}`);
    return lines.filter(Boolean).join('\n');
  };

  const wholeSchoolActivityMatcher = (act: ActivityLock) => act.scope === 'whole_school';

  if (kind === 'single_teacher') {
    const t = data.teachers.find((item) => item.id === targetId) || data.teachers[0];
    if (!t) return { reportTitle: 'ตารางสอนครูรายบุคคล', tables: [] };
    const officialTitle = `ตารางสอน ${t.code} ${t.firstName} ${t.lastName} ${termLabel} ${data.school.nameTh}`.trim();
    return {
      reportTitle: `ตารางสอนครู: ${t.firstName} ${t.lastName} (${t.code})`,
      tables: [
        buildMatrixForFilter(
          officialTitle,
          officialTitle,
          data,
          (e) => e.teacherId === t.id,
          formatForTeacher,
          wholeSchoolActivityMatcher
        ),
      ],
    };
  }

  if (kind === 'all_teachers') {
    return {
      reportTitle: 'ตารางสอนครูทุกคน',
      tables: data.teachers.map((t) => {
        const officialTitle = `ตารางสอน ${t.code} ${t.firstName} ${t.lastName} ${termLabel} ${data.school.nameTh}`.trim();
        return buildMatrixForFilter(
          officialTitle,
          officialTitle,
          data,
          (e) => e.teacherId === t.id,
          formatForTeacher,
          wholeSchoolActivityMatcher
        );
      }),
    };
  }

  if (kind === 'single_classroom') {
    const c = data.classrooms.find((item) => item.id === targetId) || data.classrooms[0];
    if (!c) return { reportTitle: 'ตารางเรียนรายห้อง', tables: [] };
    const officialTitle = `ตารางเรียน ชั้น ${c.name} ${termLabel} ${data.school.nameTh}`.trim();
    return {
      reportTitle: `ตารางเรียนชั้น ${c.name}`,
      tables: [
        buildMatrixForFilter(
          officialTitle,
          officialTitle,
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
      tables: data.classrooms.map((c) => {
        const officialTitle = `ตารางเรียน ชั้น ${c.name} ${termLabel} ${data.school.nameTh}`.trim();
        return buildMatrixForFilter(
          officialTitle,
          officialTitle,
          data,
          (e) => e.classroomId === c.id,
          formatForClassroom,
          (act) =>
            act.scope === 'whole_school' ||
            (act.scope === 'grade_level' && act.targetGradeLevel === c.gradeLevel) ||
            (act.scope === 'classroom' && act.targetClassroomId === c.id)
        );
      }),
    };
  }

  if (kind === 'single_room') {
    const r = data.rooms.find((item) => item.id === targetId) || data.rooms[0];
    if (!r) return { reportTitle: 'ตารางใช้ห้องรายห้อง', tables: [] };
    const officialTitle = `ตารางการใช้ห้อง ${r.code} ${r.name} ${termLabel} ${data.school.nameTh}`.trim();
    return {
      reportTitle: `ตารางการใช้ห้อง ${r.code} — ${r.name}`,
      tables: [
        buildMatrixForFilter(
          officialTitle,
          officialTitle,
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
      tables: data.rooms.map((r) => {
        const officialTitle = `ตารางการใช้ห้อง ${r.code} ${r.name} ${termLabel} ${data.school.nameTh}`.trim();
        return buildMatrixForFilter(
          officialTitle,
          officialTitle,
          data,
          (e) => e.roomId === r.id,
          formatForRoom,
          (act) => act.roomId === r.id
        );
      }),
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

  const workloadTitle = `รายงานภาระงานสอนของครู ${termLabel} ${data.school.nameTh}`.trim();

  return {
    reportTitle: 'รายงานภาระงานสอนของครู',
    tables: [
      {
        subtitle: `สรุปภาระงานครูทั้งหมด ${data.teachers.length} คน (${termLabel})`,
        officialTitle: workloadTitle,
        isMatrix: false,
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
        periodNumbers: [],
        periodTimes: [],
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

async function ensureSarabunLoaded(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load('400 32px "Sarabun"'),
      document.fonts.load('500 32px "Sarabun"'),
      document.fonts.load('600 36px "Sarabun"'),
      document.fonts.load('700 48px "Sarabun"'),
    ]);
    await document.fonts.ready;
  } catch {
    // Proceed cleanly even if offline font loading falls back
  }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [];
  const rawLines = text.split('\n');
  const out: string[] = [];
  for (const rawLine of rawLines) {
    let line = rawLine.trim();
    if (!line) continue;
    while (line.length > 0 && ctx.measureText(line).width > maxWidth) {
      let cut = line.length;
      while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) {
        cut--;
      }
      out.push(line.slice(0, cut));
      line = line.slice(cut);
    }
    if (line.length > 0) {
      out.push(line);
    }
  }
  return out;
}

function drawCenteredCellText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cellX: number,
  cellY: number,
  cellW: number,
  cellH: number,
  lineHeight: number
) {
  const lines = wrapLines(ctx, text, cellW - 20);
  if (lines.length === 0) return;

  const totalTextHeight = lines.length * lineHeight;
  const startY = cellY + (cellH - totalTextHeight) / 2 + lineHeight / 2;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    ctx.fillText(line, cellX + cellW / 2, startY + i * lineHeight);
  });
  ctx.restore();
}

function drawSingleLineFitCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  maxWidth: number,
  baseFont: (size: number) => string,
  baseSize: number,
  minSize = 20
) {
  let size = baseSize;
  ctx.font = baseFont(size);
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = baseFont(size);
  }
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, centerX, centerY);
  ctx.restore();
}

export async function generatePdfBlob(
  kind: ReportKind,
  data: ExportDataset,
  targetId?: string
): Promise<Blob> {
  await ensureSarabunLoaded();
  const { tables } = buildReportSpecs(kind, data, targetId);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logoImg = await loadImageElement(data.school.logoUrl);

  const pageTables: MatrixTableSpec[] =
    tables.length > 0
      ? tables
      : [
          {
            subtitle: 'ไม่พบข้อมูล',
            officialTitle: `${data.school.nameTh} ${data.semesterYearLabel || data.academicLabel}`,
            isMatrix: false,
            headers: ['สถานะ'],
            periodNumbers: [],
            periodTimes: [],
            rows: [['ยังไม่มีข้อมูลในระบบ']],
          },
        ];

  pageTables.forEach((table, idx) => {
    if (idx > 0) pdf.addPage();

    const canvas = document.createElement('canvas');
    canvas.width = 3508; // Exact A4 Landscape @300dpi (297 x 210 mm)
    canvas.height = 2480;
    const ctx = canvas.getContext('2d')!;

    // Pure white official paper background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const marginX = 160;
    const tableW = canvas.width - marginX * 2; // 3188 px

    // 1. Official Logo (Top Left)
    if (logoImg) {
      const boxSize = 215;
      const logoX = marginX;
      const logoY = 82;
      const scale = Math.min(boxSize / logoImg.width, boxSize / logoImg.height);
      const drawW = logoImg.width * scale;
      const drawH = logoImg.height * scale;
      ctx.drawImage(
        logoImg,
        logoX + (boxSize - drawW) / 2,
        logoY + (boxSize - drawH) / 2,
        drawW,
        drawH
      );
    }

    // 2. Centered Official Document Title (aligned beside logo just above table)
    const titleMaxW = logoImg ? tableW - 520 : tableW;
    ctx.fillStyle = '#000000';
    drawSingleLineFitCentered(
      ctx,
      table.officialTitle,
      canvas.width / 2,
      252,
      titleMaxW,
      (s) => `600 ${s}px "Sarabun", "Noto Sans Thai", sans-serif`,
      48,
      26
    );

    // 3. Official Timetable Grid
    const tableX = marginX;
    const tableY = 320;
    const signatureReservedH = 240;
    const maxTableBottom = canvas.height - signatureReservedH;
    const availableTableH = maxTableBottom - tableY;

    if (table.isMatrix && table.periodNumbers.length > 0) {
      const periodCount = table.periodNumbers.length;
      const firstColW = Math.round(tableW * 0.105);
      const periodColW = (tableW - firstColW) / periodCount;

      const row1H = 104; // คาบที่
      const row2H = 104; // เวลา
      const headerTotalH = row1H + row2H;

      const rowCount = Math.max(1, table.rows.length);
      const rowH = Math.min(315, Math.floor((availableTableH - headerTotalH) / rowCount));
      const totalTableH = headerTotalH + rowH * rowCount;

      // White fill for whole table
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tableX, tableY, tableW, totalTableH);

      // Header Row 1: คาบที่ | 1 | 2 | ...
      ctx.fillStyle = '#000000';
      ctx.font = '700 40px "Sarabun", "Noto Sans Thai", sans-serif';
      drawCenteredCellText(ctx, 'คาบที่', tableX, tableY, firstColW, row1H, 44);

      table.periodNumbers.forEach((num, pIdx) => {
        const cx = tableX + firstColW + pIdx * periodColW;
        drawSingleLineFitCentered(
          ctx,
          num,
          cx + periodColW / 2,
          tableY + row1H / 2,
          periodColW - 16,
          (s) => `500 ${s}px "Sarabun", "Noto Sans Thai", sans-serif`,
          34,
          22
        );
      });

      // Header Row 2: เวลา | 08.30-09.20 | ...
      ctx.fillStyle = '#000000';
      ctx.font = '700 38px "Sarabun", "Noto Sans Thai", sans-serif';
      drawCenteredCellText(ctx, 'เวลา', tableX, tableY + row1H, firstColW, row2H, 42);

      table.periodTimes.forEach((timeRange, pIdx) => {
        const cx = tableX + firstColW + pIdx * periodColW;
        drawSingleLineFitCentered(
          ctx,
          timeRange,
          cx + periodColW / 2,
          tableY + row1H + row2H / 2,
          periodColW - 14,
          (s) => `500 ${s}px "Sarabun", "Noto Sans Thai", sans-serif`,
          31,
          18
        );
      });

      // Body Rows (Days + Periods)
      table.rows.forEach((row, rIdx) => {
        const ry = tableY + headerTotalH + rIdx * rowH;

        // Day Label
        ctx.fillStyle = '#000000';
        ctx.font = '700 42px "Sarabun", "Noto Sans Thai", sans-serif';
        drawCenteredCellText(ctx, row[0] || '', tableX, ry, firstColW, rowH, 48);

        // Period Cells (Centered 3-line text, blank when empty)
        const periodFontSize = periodCount > 10 ? 28 : 34;
        const periodLineH = periodCount > 10 ? 40 : 48;
        ctx.font = `500 ${periodFontSize}px "Sarabun", "Noto Sans Thai", sans-serif`;
        ctx.fillStyle = '#000000';
        for (let pIdx = 0; pIdx < periodCount; pIdx++) {
          const cx = tableX + firstColW + pIdx * periodColW;
          const cellVal = row[pIdx + 1] || '';
          if (cellVal) {
            drawCenteredCellText(ctx, cellVal, cx, ry, periodColW, rowH, periodLineH);
          }
        }
      });

      // Crisp Black Grid Lines
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;

      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(tableX, tableY + row1H);
      ctx.lineTo(tableX + tableW, tableY + row1H);
      ctx.moveTo(tableX, tableY + headerTotalH);
      ctx.lineTo(tableX + tableW, tableY + headerTotalH);
      for (let r = 1; r < rowCount; r++) {
        const ly = tableY + headerTotalH + r * rowH;
        ctx.moveTo(tableX, ly);
        ctx.lineTo(tableX + tableW, ly);
      }
      ctx.stroke();

      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(tableX + firstColW, tableY);
      ctx.lineTo(tableX + firstColW, tableY + totalTableH);
      for (let p = 1; p < periodCount; p++) {
        const lx = tableX + firstColW + p * periodColW;
        ctx.moveTo(lx, tableY);
        ctx.lineTo(lx, tableY + totalTableH);
      }
      ctx.stroke();

      // Thick Outer Border
      ctx.lineWidth = 4;
      ctx.strokeRect(tableX, tableY, tableW, totalTableH);

      // 4. Official Dual Signature Block right under table
      const sigY = Math.min(canvas.height - 110, tableY + totalTableH + 110);
      ctx.fillStyle = '#000000';
      ctx.font = '500 42px "Sarabun", "Noto Sans Thai", sans-serif';
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        'ลงชื่อ.........................................................รองผู้อำนวยการ',
        tableX + tableW * 0.28,
        sigY
      );
      ctx.fillText(
        'ลงชื่อ.........................................................ผู้อำนวยการ',
        tableX + tableW * 0.72,
        sigY
      );
      ctx.restore();
    } else {
      // Teacher Workload Summary Table (Official White + Sarabun)
      const colCount = Math.max(1, table.headers.length);
      const colW = tableW / colCount;
      const headerH = 120;
      const displayRows = table.rows.slice(0, 14);
      const rowH = Math.min(130, Math.floor((availableTableH - headerH) / Math.max(1, displayRows.length)));
      const totalTableH = headerH + rowH * displayRows.length;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tableX, tableY, tableW, totalTableH);

      ctx.fillStyle = '#000000';
      ctx.font = '700 32px "Sarabun", "Noto Sans Thai", sans-serif';
      table.headers.forEach((h, cIdx) => {
        const cx = tableX + cIdx * colW;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(cx, tableY, colW, headerH);
        drawCenteredCellText(ctx, h, cx, tableY, colW, headerH, 38);
      });

      ctx.font = '400 28px "Sarabun", "Noto Sans Thai", sans-serif';
      displayRows.forEach((row, rIdx) => {
        const ry = tableY + headerH + rIdx * rowH;
        row.forEach((cell, cIdx) => {
          const cx = tableX + cIdx * colW;
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.strokeRect(cx, ry, colW, rowH);
          ctx.fillStyle = '#000000';
          drawCenteredCellText(ctx, cell || '-', cx, ry, colW, rowH, 34);
        });
      });

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.strokeRect(tableX, tableY, tableW, totalTableH);

      const sigY = Math.min(canvas.height - 110, tableY + totalTableH + 110);
      ctx.fillStyle = '#000000';
      ctx.font = '500 42px "Sarabun", "Noto Sans Thai", sans-serif';
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        'ลงชื่อ.........................................................รองผู้อำนวยการ',
        tableX + tableW * 0.28,
        sigY
      );
      ctx.fillText(
        'ลงชื่อ.........................................................ผู้อำนวยการ',
        tableX + tableW * 0.72,
        sigY
      );
      ctx.restore();
    }

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
      const sheetRows = table.isMatrix
        ? [
            [table.officialTitle],
            [],
            ['คาบที่', ...table.periodNumbers],
            ['เวลา', ...table.periodTimes],
            ...table.rows.map((r) => r.map((c) => c.replace(/\n/g, ' | '))),
            [],
            ['ลงชื่อ..........................................รองผู้อำนวยการ', '', '', '', 'ลงชื่อ..........................................ผู้อำนวยการ'],
          ]
        : [
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
