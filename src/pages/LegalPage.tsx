import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import { ThemeSwitcher } from '../components/theme/ThemeSwitcher';
import { useTheme } from '../contexts/ThemeContext';

export function LegalPage({ mode }: { mode: 'privacy' | 'terms' }) {
  const isPrivacy = mode === 'privacy';
  const { theme } = useTheme();

  return (
    <div className="min-h-screen pastel-ambient-bg py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          กลับหน้าหลัก
        </Link>
        <ThemeSwitcher />
      </div>

      <div
        className="max-w-3xl mx-auto pastel-glass border rounded-3xl p-8 sm:p-10 shadow-lg"
        style={{ borderColor: theme.border }}
      >
        <div className="flex items-center gap-3 mb-4">
          <span
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isPrivacy ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
            }`}
          >
            {isPrivacy ? <ShieldCheck className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
          </span>
          <h1 className="text-2xl font-bold text-slate-900">
            {isPrivacy
              ? 'นโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA Privacy Policy)'
              : 'เงื่อนไขและข้อตกลงการใช้บริการ (Terms of Service)'}
          </h1>
        </div>

        <div className="mt-6 space-y-4 text-sm text-slate-700 leading-relaxed">
          {isPrivacy ? (
            <>
              <p>
                ระบบจัดตารางสอน ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
              </p>
              <h2 className="text-base font-bold text-slate-900 pt-2">1. การแยกข้อมูลระดับโรงเรียน (Tenant Isolation)</h2>
              <p>
                ข้อมูลครู รายวิชา ห้องเรียน ตารางสอน และเอกสารทางการเงินของแต่ละสถานศึกษาถูกแยกขาดจากกันภายใต้รหัสโรงเรียน (schoolId) และควบคุมสิทธิ์ผ่าน Firebase Security Rules อย่างเข้มงวด
              </p>
              <h2 className="text-base font-bold text-slate-900 pt-2">2. การเก็บรักษาและการสำรองข้อมูล</h2>
              <p>
                เมื่อสมาชิกภาพหมดอายุ ระบบจะเปลี่ยนเป็นโหมดอ่านอย่างเดียว (Read-only) โดยไม่ลบข้อมูลของโรงเรียนโดยอัตโนมัติ ผู้ดูแลโรงเรียนสามารถส่งออกรายงานหรือต่ออายุสมาชิกเพื่อกลับมาแก้ไขข้อมูลได้ตลอดเวลา
              </p>
              <h2 className="text-base font-bold text-slate-900 pt-2">3. บันทึกความปลอดภัย (Audit Logs)</h2>
              <p>
                การดำเนินการสำคัญ เช่น การเข้าถึงข้อมูล การปรับเปลี่ยนสิทธิ์สมาชิก และการชำระเงิน จะถูกบันทึกไว้ใน Audit Logs เพื่อความโปร่งใสและตรวจสอบย้อนหลังได้
              </p>
            </>
          ) : (
            <>
              <p>
                ข้อตกลงนี้ครอบคลุมการใช้งาน ระบบจัดตารางสอน แบบสมัครสมาชิกรายปี
              </p>
              <h2 className="text-base font-bold text-slate-900 pt-2">1. ช่วงทดลองใช้งานฟรี 14 วัน</h2>
              <p>
                สถานศึกษาที่สมัครใหม่จะได้รับสิทธิ์ทดลองใช้งานฟรีตามจำนวนวันที่แพลตฟอร์มกำหนด พร้อมการแจ้งเตือนล่วงหน้า 7, 3 และ 1 วันก่อนหมดอายุ
              </p>
              <h2 className="text-base font-bold text-slate-900 pt-2">2. การชำระเงินและการต่ออายุ</h2>
              <p>
                รองรับการโอนเงินแนบสลิป (ตรวจสอบและอนุมัติโดยผู้ดูแลแพลตฟอร์ม) และการชำระเงินผ่าน Payment Gateway เมื่อครบกำหนดและยังไม่ได้ต่ออายุ สถานะจะเข้าสู่ Read-only โดยข้อมูลทั้งหมดยังคงอยู่ครบถ้วน
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
