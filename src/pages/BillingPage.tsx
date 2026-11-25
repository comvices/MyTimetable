import React, { useEffect, useState } from 'react';
import { Building, CheckCircle2, CreditCard, ShieldCheck, Sparkles, Upload, X } from 'lucide-react';
import { motion } from 'motion/react';
import { WorkspaceShell } from '../components/layout/WorkspaceShell';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { formatErrorMessage } from '../lib/firestoreError';
import { getSubscriptionStatusLabel } from '../lib/tenant';
import {
  fetchSchoolPayments,
  initiateAndVerifyGatewayPayment,
  submitBankTransferPayment,
  uploadPaymentSlip,
  validateCouponCode,
} from '../services/subscriptionService';
import { Coupon, PaymentRecord, Plan } from '../types/saas';

export function BillingPage() {
  const { currentUser } = useAuth();
  const { school, plans, currentPlan, platformSettings, daysRemaining, refreshTenant } = useTenant();
  const { theme } = useTheme();
  const { showToast } = useToast();

  const [selectedPlan, setSelectedPlan] = useState<Plan>(currentPlan);
  const [method, setMethod] = useState<'bank_transfer' | 'gateway'>('bank_transfer');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [slipPreview, setSlipPreview] = useState('');
  const [slipBlob, setSlipBlob] = useState<Blob | null>(null);
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 16));
  const [transferRef, setTransferRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  useEffect(() => {
    setSelectedPlan(currentPlan);
  }, [currentPlan]);

  useEffect(() => {
    if (!school?.id) return;
    void fetchSchoolPayments(school.id).then(setPayments).catch(() => {});
  }, [school?.id]);

  if (!school || !currentUser) {
    return (
      <WorkspaceShell title="แพ็กเกจและการชำระเงิน">
        <div
          className="p-8 pastel-glass rounded-2xl border text-sm text-slate-500"
          style={{ borderColor: theme.border }}
        >
          กำลังโหลด...
        </div>
      </WorkspaceShell>
    );
  }

  const actor = {
    uid: currentUser.uid,
    email: currentUser.email || '',
    displayName: currentUser.displayName || currentUser.username,
  };

  const discountAmount = appliedCoupon
    ? Math.round((selectedPlan.priceAnnual * appliedCoupon.discountPercent) / 100)
    : 0;
  const finalAmount = Math.max(0, selectedPlan.priceAnnual - discountAmount);

  const handleApplyCoupon = async () => {
    const found = await validateCouponCode(couponInput);
    if (!found) {
      setAppliedCoupon(null);
      showToast('ไม่พบโค้ดส่วนลดนี้ หรือโค้ดหมดอายุ/ถูกใช้ครบแล้ว', 'warning');
      return;
    }
    setAppliedCoupon(found);
    showToast(`ใช้โค้ด ${found.code} ลด ${found.discountPercent}% สำเร็จ`, 'success');
  };

  const handleSlipFile = (file: File) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxW = 900;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            setSlipBlob(blob);
            setSlipPreview(canvas.toDataURL('image/webp', 0.8));
          }
        },
        'image/webp',
        0.8
      );
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slipBlob || !transferRef.trim()) {
      showToast('กรุณาแนบสลิปโอนเงินและระบุเลขอ้างอิงการโอน', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const slipUrl = await uploadPaymentSlip(school.id, slipBlob);
      await submitBankTransferPayment(
        {
          school,
          plan: selectedPlan,
          amount: finalAmount,
          discountAmount,
          couponCode: appliedCoupon?.code,
          slipUrl,
          transferDate,
          transferReference: transferRef,
        },
        actor
      );
      setSlipBlob(null);
      setSlipPreview('');
      setTransferRef('');
      const [updated] = await Promise.all([
        fetchSchoolPayments(school.id),
        refreshTenant(),
      ]);
      setPayments(updated);
      showToast('ส่งหลักฐานการโอนเงินแล้ว รอ Super Admin ตรวจสอบอนุมัติ', 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGatewayCheckout = async () => {
    setSubmitting(true);
    try {
      const res = await initiateAndVerifyGatewayPayment(
        {
          school,
          plan: selectedPlan,
          amount: finalAmount,
          discountAmount,
          couponCode: appliedCoupon?.code,
        },
        actor
      );
      const [updated] = await Promise.all([
        fetchSchoolPayments(school.id),
        refreshTenant(),
      ]);
      setPayments(updated);
      showToast(`ชำระเงินผ่าน Gateway และยืนยันลายเซ็น Session ${res.sessionId} สำเร็จ`, 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const statusMeta = getSubscriptionStatusLabel(school.subscriptionStatus);

  return (
    <WorkspaceShell title="แพ็กเกจและการต่ออายุสมาชิก" breadcrumb={school.nameTh}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-6"
      >
        {/* Current Subscription Summary */}
        <div
          className="pastel-glass border rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4"
          style={{ borderColor: theme.border }}
        >
          <div className="flex items-start gap-3.5">
            <span
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xs"
              style={{
                background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
              }}
            >
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <div className="text-xs text-slate-500">แพ็กเกจปัจจุบัน</div>
              <div className="text-xl font-bold text-slate-900 mt-0.5">
                {currentPlan.name} · ฿{currentPlan.priceAnnual.toLocaleString()}/ปี
              </div>
              <div className="text-xs text-slate-600 mt-1 tabular-nums">
                จำกัดครูสูงสุด {currentPlan.maxTeachers} คน · สถานะ: {statusMeta.label}
                {daysRemaining !== null && daysRemaining >= 0 && ` (เหลือ ${daysRemaining} วัน)`}
              </div>
            </div>
          </div>
          <div
            className="px-4 py-2.5 rounded-xl border text-xs text-slate-600"
            style={{ backgroundColor: theme.pastelSoft, borderColor: theme.border }}
          >
            หมายเหตุ: เมื่อหมดอายุข้อมูลโรงเรียนจะไม่ถูกลบ แต่จะเข้าสู่โหมดอ่านอย่างเดียวจนกว่าจะต่ออายุ
          </div>
        </div>

        {/* Select Plan */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => {
            const isSelected = selectedPlan.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPlan(p)}
                className="p-5 rounded-2xl border text-left transition-all pastel-glass pastel-card-hover"
                style={{
                  borderColor: isSelected ? theme.primary : theme.border,
                  backgroundColor: isSelected ? theme.pastelSoft : undefined,
                  boxShadow: isSelected ? `0 0 0 1px ${theme.primary}` : undefined,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-slate-900">{p.name}</span>
                  {isSelected && <CheckCircle2 className="w-4 h-4" style={{ color: theme.primary }} />}
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">
                  ฿{p.priceAnnual.toLocaleString()}
                  <span className="text-xs font-normal text-slate-500"> / ปี</span>
                </div>
                <div className="text-xs text-slate-600 mt-1 tabular-nums">
                  รองรับครูสูงสุด {p.maxTeachers} คน
                </div>
              </button>
            );
          })}
        </div>

        {/* Checkout Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div
            className="lg:col-span-7 pastel-glass border rounded-2xl p-6 space-y-5"
            style={{ borderColor: theme.border }}
          >
            <div
              className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl border w-fit"
              style={{ backgroundColor: theme.pastelSoft, borderColor: theme.border }}
            >
              <button
                type="button"
                onClick={() => setMethod('bank_transfer')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  method === 'bank_transfer' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                style={method === 'bank_transfer' ? { color: theme.primary } : undefined}
              >
                <Building className="w-4 h-4" />
                โอนเงินผ่านธนาคาร (แนบสลิป)
              </button>
              <button
                type="button"
                onClick={() => setMethod('gateway')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  method === 'gateway' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                style={method === 'gateway' ? { color: theme.primary } : undefined}
              >
                <CreditCard className="w-4 h-4" />
                Payment Gateway
              </button>
            </div>

            {method === 'bank_transfer' ? (
              <form onSubmit={handleBankSubmit} className="space-y-4">
                <div
                  className="p-4 rounded-xl border text-xs space-y-1"
                  style={{ backgroundColor: theme.pastelSoft, borderColor: theme.border }}
                >
                  <div className="font-bold text-slate-900">{platformSettings.bankName}</div>
                  <div>ชื่อบัญชี: {platformSettings.bankAccountName}</div>
                  <div className="font-mono text-sm font-bold text-slate-900">
                    เลขที่บัญชี: {platformSettings.bankAccountNumber}
                  </div>
                  {platformSettings.promptPayId && (
                    <div className="font-mono text-slate-700">
                      PromptPay ID: {platformSettings.promptPayId}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">วัน-เวลาที่โอน</label>
                    <input
                      type="datetime-local"
                      value={transferDate}
                      onChange={(e) => setTransferDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      เลขอ้างอิงสลิป *
                    </label>
                    <input
                      type="text"
                      value={transferRef}
                      onChange={(e) => setTransferRef(e.target.value)}
                      placeholder="เช่น REF20261121"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    แนบภาพสลิปโอนเงิน *
                  </label>
                  <label
                    className="flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-xl cursor-pointer hover:bg-white/70 transition-colors"
                    style={{ borderColor: theme.border }}
                  >
                    {slipPreview ? (
                      <img src={slipPreview} alt="Slip preview" className="max-h-48 rounded-lg" />
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-slate-400 mb-1.5" />
                        <span className="text-xs text-slate-600">คลิกเพื่อเลือกไฟล์สลิป (PNG, JPG, WebP)</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleSlipFile(f);
                      }}
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 text-white text-sm font-semibold rounded-xl shadow-xs hover:opacity-95 disabled:opacity-50"
                  style={{
                    background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                  }}
                >
                  {submitting ? 'กำลังอัปโหลดหลักฐาน...' : `แจ้งชำระเงิน ฿${finalAmount.toLocaleString()}`}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div
                  className="p-4 rounded-xl border text-xs text-slate-700 space-y-2"
                  style={{ backgroundColor: theme.pastelSoft, borderColor: theme.border }}
                >
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    การชำระเงินผ่าน Payment Gateway พร้อมตรวจสอบลายเซ็น Webhook
                  </div>
                  <p>
                    ระบบจะสร้าง Payment Session ฝั่ง Backend พร้อมตรวจสอบลายเซ็น HMAC-SHA256 และป้องกัน Webhook ซ้ำโดยไม่เชื่อถือข้อมูลจาก Frontend เพียงอย่างเดียว
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleGatewayCheckout()}
                  disabled={submitting}
                  className="w-full py-2.5 px-4 text-white text-sm font-semibold rounded-xl shadow-xs hover:opacity-95 disabled:opacity-50"
                  style={{
                    background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                  }}
                >
                  {submitting
                    ? 'กำลังเชื่อมต่อ Payment Gateway...'
                    : `ชำระเงินออนไลน์ ฿${finalAmount.toLocaleString()}`}
                </button>
              </div>
            )}
          </div>

          {/* Order Summary + Coupon */}
          <div
            className="lg:col-span-5 pastel-glass border rounded-2xl p-6 space-y-4 h-fit"
            style={{ borderColor: theme.border }}
          >
            <h3 className="text-base font-bold text-slate-900">สรุปยอดชำระรายปี</h3>

            <div className="flex gap-2">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="โค้ดส่วนลด (ถ้ามี)"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white"
              />
              {appliedCoupon ? (
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponInput('');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 whitespace-nowrap"
                >
                  <X className="w-3.5 h-3.5" />
                  ล้างโค้ด
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleApplyCoupon()}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl border bg-white hover:bg-slate-50 whitespace-nowrap"
                  style={{ borderColor: theme.border, color: theme.primary }}
                >
                  ใช้โค้ด
                </button>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>แพ็กเกจ {selectedPlan.name} (1 ปี)</span>
                <span className="tabular-nums">฿{selectedPlan.priceAnnual.toLocaleString()}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between text-emerald-700">
                  <span>ส่วนลด ({appliedCoupon.code} -{appliedCoupon.discountPercent}%)</span>
                  <span className="tabular-nums">-฿{discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base text-slate-900 pt-2 border-t border-slate-200">
                <span>ยอดสุทธิ</span>
                <span className="tabular-nums">฿{finalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment History */}
        <div
          className="pastel-glass border rounded-2xl overflow-hidden"
          style={{ borderColor: theme.border }}
        >
          <div
            className="px-6 py-4 border-b font-bold text-sm text-slate-900"
            style={{ borderColor: theme.border, backgroundColor: theme.pastelSoft }}
          >
            ประวัติการชำระเงินของโรงเรียน
          </div>
          {payments.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">ยังไม่มีประวัติการชำระเงิน</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="p-3.5 text-left">รหัสรายการ</th>
                    <th className="p-3.5 text-left">แพ็กเกจ</th>
                    <th className="p-3.5 text-left">ช่องทาง</th>
                    <th className="p-3.5 text-right">ยอดชำระ</th>
                    <th className="p-3.5 text-left">สถานะ</th>
                    <th className="p-3.5 text-left">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((pay) => (
                    <tr key={pay.id} className="border-b border-slate-100 last:border-b-0 hover:bg-white/60">
                      <td className="p-3.5 font-mono">{pay.id}</td>
                      <td className="p-3.5 font-semibold">{pay.planId}</td>
                      <td className="p-3.5">
                        {pay.method === 'bank_transfer' ? 'โอนเงินแนบสลิป' : 'Payment Gateway'}
                      </td>
                      <td className="p-3.5 text-right tabular-nums font-semibold">
                        ฿{pay.amount.toLocaleString()}
                      </td>
                      <td className="p-3.5 font-semibold">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md border ${
                            pay.status === 'approved'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : pay.status === 'rejected'
                              ? 'bg-rose-50 border-rose-200 text-rose-700'
                              : 'bg-amber-50 border-amber-200 text-amber-800'
                          }`}
                        >
                          {pay.status === 'approved'
                            ? 'อนุมัติแล้ว'
                            : pay.status === 'rejected'
                            ? 'ถูกปฏิเสธ'
                            : 'รอตรวจสอบ'}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500">{pay.notes || pay.transferReference || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </WorkspaceShell>
  );
}
