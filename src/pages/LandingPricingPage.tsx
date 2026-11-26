import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Building2,
  CalendarRange,
  Check,
  Clock,
  FileSpreadsheet,
  Lock,
  Palette,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { ThemeSwitcher } from '../components/theme/ThemeSwitcher';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { useTheme } from '../contexts/ThemeContext';
import { DEFAULT_BRANDING } from '../lib/tenant';
import { PlanFeatureKey } from '../types/saas';

const FEATURE_LABELS: Record<PlanFeatureKey, string> = {
  timetable: 'จัดตารางสอน Drag & Drop พร้อม Undo/Redo',
  basic_info: 'จัดการข้อมูลครู วิชา ชั้นเรียน และห้องเรียน',
  branding: 'ปรับแต่งโลโก้ ภาพหน้าปก Login และสีโรงเรียน',
  pdf_excel: 'ส่งออกรายงาน PDF และ Excel พร้อมโลโก้',
  activity_lock: 'ล็อกคาบกิจกรรมทั้งโรงเรียน / ระดับชั้น / ห้อง',
  conflict_detection: 'ตรวจสอบตารางชนแบบ Real-time + แนะนำคาบว่าง',
  teacher_dashboard: 'แดชบอร์ดภาระงานและตารางสอนครูรายบุคคล',
  room_dashboard: 'แดชบอร์ดอัตราการใช้ห้องเรียน',
  zip_export: 'ดาวน์โหลดรายงานรวมไฟล์ ZIP ในคลิกเดียว',
  auto_scheduling: 'ระบบช่วยจัดตารางสอนอัตโนมัติ (Auto Scheduling)',
  advanced_reports: 'รายงานวิเคราะห์ภาระงานเชิงลึก',
  backup_versions: 'สำรองข้อมูลและจัดการหลายเวอร์ชันตารางสอน',
  priority_support: 'การดูแลและสนับสนุนลำดับความสำคัญ',
};

export function LandingPricingPage() {
  const { currentUser, isSuperAdmin } = useAuth();
  const { plans, school, platformSettings } = useTenant();
  const { theme } = useTheme();

  const ctaPath = currentUser
    ? isSuperAdmin && !school
      ? '/super-admin'
      : school
      ? '/app/dashboard'
      : '/signup'
    : '/signup';
  const ctaLabel = currentUser
    ? isSuperAdmin && !school
      ? 'เข้าสู่ Super Admin Console'
      : school
      ? 'เข้าสู่พื้นที่โรงเรียน'
      : `ทดลองใช้ฟรี ${platformSettings.trialDays} วัน`
    : `ทดลองใช้ฟรี ${platformSettings.trialDays} วัน`;

  const capabilities = [
    {
      icon: CalendarRange,
      tileClass: 'bg-sky-100 text-sky-700',
      title: 'ตารางสอน Drag & Drop พร้อม Undo/Redo',
      desc: 'ลากวางเปลี่ยนคาบ ย้ายห้อง เปลี่ยนครูผู้สอน รองรับประวัติการแก้ไข สำรองหลายเวอร์ชัน และคัดลอกตารางจากเทอมเดิม',
    },
    {
      icon: ShieldCheck,
      tileClass: 'bg-emerald-100 text-emerald-700',
      title: 'ตรวจสอบตารางชน Real-time',
      desc: 'แจ้งเตือนทันทีเมื่อครูสอนซ้อน ห้องเรียนซ้ำ ชั้นเรียนซ้อน หรือชนคาบกิจกรรม พร้อมแนะนำคาบว่างและห้องว่างอัตโนมัติ',
    },
    {
      icon: Lock,
      tileClass: 'bg-amber-100 text-amber-700',
      title: 'ล็อกคาบกิจกรรมทั้งโรงเรียน (Global Lock)',
      desc: 'กำหนดคาบลูกเสือ-เนตรนารี ชุมนุม แนะแนว หรือกิจกรรมคุณธรรม แยกตามระดับชั้นหรือทั้งโรงเรียน พร้อมระบุสถานที่จัด',
    },
    {
      icon: Palette,
      tileClass: 'bg-pink-100 text-pink-700',
      title: 'Subdomain และอัตลักษณ์โรงเรียน (FR-09)',
      desc: 'ปรับแต่งโลโก้ 512×512 ภาพหน้าปก Login 1920×1080 สีประจำโรงเรียน และธีมพาสเทลที่เลือกได้ตามความชอบ',
    },
    {
      icon: FileSpreadsheet,
      tileClass: 'bg-violet-100 text-violet-700',
      title: 'ส่งออกรายงาน PDF / Excel / ZIP',
      desc: 'พิมพ์ตารางสอนครู ตารางเรียนชั้นเรียน ตารางใช้ห้อง และภาระงานครู พร้อมตราและชื่อโรงเรียนทุกเอกสาร',
    },
    {
      icon: Building2,
      tileClass: 'bg-teal-100 text-teal-700',
      title: 'ความปลอดภัย Multi-Tenant และ PDPA',
      desc: 'แยกข้อมูลโรงเรียนด้วย Security Rules ระดับฐานข้อมูล บันทึก Audit Logs และล็อกเป็นโหมดอ่านอย่างเดียวเมื่อหมดอายุโดยไม่ลบข้อมูล',
    },
  ];

  return (
    <div className="min-h-screen pastel-ambient-bg text-slate-900">
      {/* Top Bar */}
      <header
        className="pastel-glass border-b sticky top-0 z-30"
        style={{ borderColor: theme.border }}
      >
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            <span
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs"
              style={{
                background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
              }}
            >
              <CalendarRange className="w-4 h-4" />
            </span>
            <span>ระบบจัดตารางสอน</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              ความสามารถ
            </a>
            <a href="#visual-showcase" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              ตัวอย่างระบบ
            </a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              แพ็กเกจรายปี
            </a>
            <Link to="/login" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              เข้าสู่ระบบ
            </Link>
            {isSuperAdmin && (
              <Link
                to="/super-admin"
                className="font-semibold transition-colors whitespace-nowrap shrink-0"
                style={{ color: theme.primary }}
              >
                Super Admin Console
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <ThemeSwitcher />
            <Link
              to={ctaPath}
              className="px-4 py-2 text-xs font-semibold text-white rounded-xl transition-all shadow-xs hover:opacity-95 whitespace-nowrap shrink-0"
              style={{
                background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
              }}
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Split Section */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <motion.div
            initial={theme.effectsEnabled ? { opacity: 0, y: 14 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="lg:col-span-6 flex flex-col justify-center"
          >
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold w-fit mb-4 bg-white/80"
              style={{ borderColor: theme.border, color: theme.primary }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Multi-Tenant SaaS · แยกข้อมูลอิสระทุกโรงเรียน · ฟรี {platformSettings.trialDays} วัน</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-[1.2] text-balance">
              บริหารตารางสอนทั้งโรงเรียนให้แม่นยำ ไร้คาบชนในแพลตฟอร์มเดียว
            </h1>
            <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              ระบบจัดตารางสอนสีสันพาสเทลสบายตาสำหรับโรงเรียนประถม มัธยม และอาชีวศึกษา
              มาพร้อม Subdomain เฉพาะโรงเรียน ตรวจจับตารางชนแบบ Real-time
              และส่งออกเอกสาร PDF/Excel/ZIP พร้อมตราโรงเรียนทันที
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-xl transition-all shadow-sm hover:opacity-95 whitespace-nowrap"
                style={{
                  background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                }}
              >
                <span>สมัครใช้งานและทดลองฟรี {platformSettings.trialDays} วัน</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/90 border hover:bg-white text-slate-800 font-semibold rounded-xl transition-colors whitespace-nowrap"
                style={{ borderColor: theme.border }}
              >
                เข้าสู่ระบบโรงเรียน
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={theme.effectsEnabled ? { opacity: 0, scale: 0.97 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.08, ease: 'easeOut' }}
            className="lg:col-span-6"
          >
            <div
              className="p-2.5 rounded-3xl border bg-white/80 shadow-lg pastel-card-hover"
              style={{ borderColor: theme.border }}
            >
              <div className="aspect-[16/10] rounded-2xl overflow-hidden bg-slate-100">
                <img
                  src={DEFAULT_BRANDING.heroImageUrl}
                  alt="อาคารเรียนพาสเทลสดใสและระบบบริหารงานวิชาการโรงเรียน"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* 4-Column Proof Strip */}
        <div
          className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4 pastel-glass border rounded-2xl p-6 shadow-xs"
          style={{ borderColor: theme.border }}
        >
          {[
            {
              icon: Clock,
              tile: 'bg-sky-100 text-sky-700',
              value: `${platformSettings.trialDays} วัน`,
              desc: 'ทดลองใช้งานฟรีทุกฟีเจอร์หลัก',
            },
            {
              icon: Users,
              tile: 'bg-violet-100 text-violet-700',
              value: '4 บทบาท',
              desc: 'Super Admin · School Admin · ฝ่ายจัดตาราง · ครู',
            },
            {
              icon: ShieldCheck,
              tile: 'bg-emerald-100 text-emerald-700',
              value: 'Real-time',
              desc: 'ตรวจจับครู/ห้อง/ชั้น/กิจกรรมชนทันที',
            },
            {
              icon: Palette,
              tile: 'bg-pink-100 text-pink-700',
              value: '6 ธีมพาสเทล',
              desc: 'เลือกธีม ปรับสี และเปิดเอฟเฟกต์ได้ทันที',
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.value} className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.tile}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                    {stat.value}
                  </div>
                  <div className="text-xs sm:text-sm text-slate-500 mt-0.5">{stat.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Visual Showcase Section */}
      <section id="visual-showcase" className="max-w-[1280px] mx-auto px-4 sm:px-6 pb-16">
        <div
          className="rounded-3xl border p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
          style={{
            borderColor: theme.border,
            background: `linear-gradient(135deg, ${theme.pastelSoft} 0%, ${theme.pastelAlt} 55%, #ffffff 100%)`,
          }}
        >
          <div className="lg:col-span-6">
            <div
              className="rounded-2xl overflow-hidden border bg-white shadow-md pastel-card-hover"
              style={{ borderColor: theme.border }}
            >
              <img
                src={DEFAULT_BRANDING.pastelIllustrationUrl}
                alt="กราฟิกตารางสอนพาสเทลและระบบจัดตารางเรียน"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div className="lg:col-span-6 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
              ทำงานจัดตารางสอนได้เพลิดเพลิน ด้วยธีมพาสเทลที่ปรับแต่งเองได้
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              ลดความล้าสายตาขณะจัดตารางสอนหลายสิบห้องเรียนด้วยชุดสีพาสเทลที่ออกแบบมาเพื่อความสบายตา
              เลือกสลับได้ทันที 6 โทนสี หรือผสมสีพาสเทลเฉพาะตัวพร้อมเอฟเฟกต์ Glassmorphism นุ่มนวล
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-white/85 border" style={{ borderColor: theme.border }}>
                <div className="text-sm font-bold text-slate-900">ไอคอนเมนูแยกสีชัดเจน</div>
                <div className="text-xs text-slate-600 mt-1">ช่วยให้ทีมวิชาการและครูค้นหาเมนูได้รวดเร็ว</div>
              </div>
              <div className="p-3.5 rounded-xl bg-white/85 border" style={{ borderColor: theme.border }}>
                <div className="text-sm font-bold text-slate-900">อัตลักษณ์เฉพาะโรงเรียน</div>
                <div className="text-xs text-slate-600 mt-1">ตั้งค่าภาพหน้าปก Login และโลโก้ของโรงเรียนได้</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section
        id="features"
        className="bg-white/85 border-y py-16"
        style={{ borderColor: theme.border }}
      >
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              ออกแบบครบตามกระบวนการงานวิชาการโรงเรียนไทย
            </h2>
            <p className="mt-2 text-slate-600">
              ครอบคลุมตั้งแต่การตั้งค่าอัตลักษณ์โรงเรียน การล็อกคาบกิจกรรม ไปจนถึงการออกเอกสารราชการ
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={theme.effectsEnabled ? { opacity: 0, y: 12 } : false}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                  className="p-6 rounded-2xl border bg-white/95 pastel-card-hover"
                  style={{ borderColor: theme.border }}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${item.tileClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Annual Pricing */}
      <section id="pricing" className="max-w-[1280px] mx-auto px-4 sm:px-6 py-16">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            แพ็กเกจสมาชิกรายปีสำหรับทุกขนาดโรงเรียน
          </h2>
          <p className="mt-2 text-slate-600">
            เริ่มต้นทดลองใช้งานฟรี {platformSettings.trialDays} วัน รองรับทั้งโอนเงินแนบสลิปและ Payment Gateway
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {plans.map((plan) => {
            const isHighlighted = plan.id === 'professional';
            return (
              <div
                key={plan.id}
                className={`rounded-2xl border p-6 sm:p-8 flex flex-col justify-between bg-white/95 pastel-card-hover ${
                  isHighlighted ? 'ring-2 shadow-md' : ''
                }`}
                style={{
                  borderColor: isHighlighted ? theme.primary : theme.border,
                  boxShadow: isHighlighted ? `0 12px 28px -12px ${theme.primary}40` : undefined,
                }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                    {isHighlighted && (
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                        style={{ backgroundColor: theme.pastelSoft, color: theme.primary }}
                      >
                        แนะนำสำหรับโรงเรียน
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-600 min-h-[40px]">{plan.description}</p>

                  <div className="mt-6 pb-6 border-b border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-slate-900 tabular-nums">
                        ฿{plan.priceAnnual.toLocaleString()}
                      </span>
                      <span className="text-sm text-slate-500">/ ปี</span>
                    </div>
                    <div className="mt-1 text-xs font-medium text-slate-600 tabular-nums">
                      รองรับครูสูงสุด {plan.maxTeachers.toLocaleString()} คน
                    </div>
                  </div>

                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        <span>{FEATURE_LABELS[feat] || feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  to={`/signup?plan=${plan.id}`}
                  className={`mt-8 w-full py-2.5 px-4 rounded-xl text-center text-sm font-semibold transition-all ${
                    isHighlighted
                      ? 'text-white shadow-xs hover:opacity-95'
                      : 'text-slate-900 hover:bg-slate-200/80'
                  }`}
                  style={
                    isHighlighted
                      ? {
                          background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                        }
                      : { backgroundColor: theme.pastelSoft }
                  }
                >
                  เริ่มทดลองใช้ {plan.name} ฟรี {platformSettings.trialDays} วัน
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white/90 border-t py-8" style={{ borderColor: theme.border }}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>© {new Date().getFullYear()} ระบบจัดตารางสอน · Multi-Tenant School Timetable Platform</div>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="hover:text-slate-900">
              นโยบายความเป็นส่วนตัว (PDPA)
            </Link>
            <Link to="/terms" className="hover:text-slate-900">
              เงื่อนไขการใช้บริการ
            </Link>
            <Link to="/login" className="hover:text-slate-900">
              เข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
