import React, { useEffect, useState } from 'react';
import { Copy, Eye, Image as ImageIcon, Save, UserPlus, Users } from 'lucide-react';
import { ImageCropModal } from '../components/branding/ImageCropModal';
import { WorkspaceShell } from '../components/layout/WorkspaceShell';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { PASTEL_THEMES } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useSchoolWorkspace } from '../hooks/useSchoolWorkspace';
import { formatErrorMessage } from '../lib/firestoreError';
import { DEFAULT_BRANDING } from '../lib/tenant';
import {
  createSchoolInvite,
  deleteSchoolDoc,
  updateSchoolProfileAndBranding,
  uploadBrandingAsset,
  upsertSchoolDoc,
} from '../services/schoolService';

type CropTarget = {
  kind: 'logo' | 'login-cover' | 'background';
  file: File;
  width: number;
  height: number;
  title: string;
};

export function SchoolProfileBrandingPage() {
  const { currentUser } = useAuth();
  const { school, isReadOnly, refreshTenant } = useTenant();
  const { showToast, confirmAction } = useToast();
  const workspace = useSchoolWorkspace();

  const [tab, setTab] = useState<'profile' | 'branding' | 'members'>('profile');
  const [saving, setSaving] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);

  // School Profile Form (FR-09)
  const [form, setForm] = useState({
    nameTh: '',
    nameEn: '',
    schoolCode: '',
    affiliation: '',
    address: '',
    province: '',
    district: '',
    subdistrict: '',
    postalCode: '',
    phone: '',
    email: '',
    website: '',
    directorName: '',
    academicYear: '',
    semester: '',
    primaryColor: '#0f3d75',
    secondaryColor: '#1e6fb8',
    welcomeMessage: '',
    logoUrl: '',
    loginCoverUrl: '',
    backgroundUrl: '',
  });

  // Member Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'school_admin' | 'scheduler' | 'teacher'>('scheduler');
  const [inviteTeacherId, setInviteTeacherId] = useState('');

  useEffect(() => {
    if (!school) return;
    setForm({
      nameTh: school.nameTh || '',
      nameEn: school.nameEn || '',
      schoolCode: school.schoolCode || '',
      affiliation: school.affiliation || '',
      address: school.address || '',
      province: school.province || '',
      district: school.district || '',
      subdistrict: school.subdistrict || '',
      postalCode: school.postalCode || '',
      phone: school.phone || '',
      email: school.email || '',
      website: school.website || '',
      directorName: school.directorName || '',
      academicYear: school.academicYear || '',
      semester: school.semester || '',
      primaryColor: school.primaryColor || '#0f3d75',
      secondaryColor: school.secondaryColor || '#1e6fb8',
      welcomeMessage: school.welcomeMessage || '',
      logoUrl: school.logoUrl || '',
      loginCoverUrl: school.loginCoverUrl || '',
      backgroundUrl: school.backgroundUrl || '',
    });
  }, [school]);

  if (!school || !currentUser) {
    return (
      <WorkspaceShell title="ตั้งค่าโรงเรียน & อัตลักษณ์ (FR-09)">
        <div className="p-8 bg-white border border-slate-200 rounded-xl text-sm text-slate-500">
          กำลังโหลดข้อมูลโรงเรียน...
        </div>
      </WorkspaceShell>
    );
  }

  const actor = {
    uid: currentUser.uid,
    email: currentUser.email || '',
    displayName: currentUser.displayName || currentUser.username,
  };

  const handleSaveProfileAndBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      showToast('โรงเรียนอยู่ในโหมดอ่านอย่างเดียว ไม่สามารถบันทึกข้อมูลได้', 'warning');
      return;
    }
    setSaving(true);
    try {
      await updateSchoolProfileAndBranding(school, form, actor);
      await refreshTenant();
      showToast('บันทึกข้อมูลโรงเรียนและอัตลักษณ์เรียบร้อยแล้ว', 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCroppedUpload = async (blob: Blob) => {
    if (!cropTarget || isReadOnly) return;
    setSaving(true);
    try {
      const url = await uploadBrandingAsset(school.id, cropTarget.kind, blob);
      if (cropTarget.kind === 'logo') setForm((f) => ({ ...f, logoUrl: url }));
      if (cropTarget.kind === 'login-cover') setForm((f) => ({ ...f, loginCoverUrl: url }));
      if (cropTarget.kind === 'background') setForm((f) => ({ ...f, backgroundUrl: url }));
      setCropTarget(null);
      showToast('อัปโหลดและปรับขนาดภาพสำเร็จ กรุณากด "บันทึกการตั้งค่า"', 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !inviteEmail.trim()) return;
    setSaving(true);
    try {
      const invite = await createSchoolInvite(
        school.id,
        inviteEmail,
        inviteRole,
        inviteTeacherId,
        actor
      );
      setInviteEmail('');
      const link = `${window.location.origin}/s/${school.slug}/login?invite=${invite.id}`;
      await navigator.clipboard?.writeText(link).catch(() => {});
      showToast('สร้างคำเชิญและคัดลอกลิงก์เข้าร่วมโรงเรียนแล้ว', 'success');
    } catch (err) {
      showToast(formatErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const loginLink = `${window.location.origin}/s/${school.slug}/login`;

  return (
    <WorkspaceShell
      title="ตั้งค่าโรงเรียน & อัตลักษณ์ (FR-09)"
      breadcrumb={`Subdomain: ${school.slug}`}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg whitespace-nowrap"
          >
            <Eye className="w-4 h-4" />
            <span>พรีวิวหน้า Login</span>
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(loginLink);
              showToast('คัดลอกลิงก์หน้า Login ของโรงเรียนแล้ว', 'success');
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
          >
            <Copy className="w-4 h-4" />
            <span>คัดลอกลิงก์โรงเรียน</span>
          </button>
        </div>
      }
    >
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit mb-6">
        {[
          { id: 'profile', label: 'ข้อมูลทั่วไปโรงเรียน' },
          { id: 'branding', label: 'โลโก้ ภาพปก & สีโรงเรียน' },
          { id: 'members', label: 'สมาชิก & สิทธิ์ผู้ใช้งาน' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id as 'profile' | 'branding' | 'members')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              tab === item.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab !== 'members' ? (
        <form onSubmit={handleSaveProfileAndBranding} className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          {tab === 'profile' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อโรงเรียน (ภาษาไทย) *</label>
                <input
                  type="text"
                  value={form.nameTh}
                  onChange={(e) => setForm({ ...form, nameTh: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">รหัสโรงเรียน (SMIS/OBEC)</label>
                <input
                  type="text"
                  value={form.schoolCode}
                  onChange={(e) => setForm({ ...form, schoolCode: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อโรงเรียน (ภาษาอังกฤษ)</label>
                <input
                  type="text"
                  value={form.nameEn}
                  onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">สังกัด</label>
                <input
                  type="text"
                  value={form.affiliation}
                  onChange={(e) => setForm({ ...form, affiliation: e.target.value })}
                  placeholder="สพม. / สพป. / เอกชน / อปท."
                  disabled={isReadOnly}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">ที่อยู่</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ตำบล / แขวง</label>
                <input
                  type="text"
                  value={form.subdistrict}
                  onChange={(e) => setForm({ ...form, subdistrict: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">อำเภอ / เขต</label>
                <input
                  type="text"
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">จังหวัด</label>
                <input
                  type="text"
                  value={form.province}
                  onChange={(e) => setForm({ ...form, province: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">รหัสไปรษณีย์</label>
                <input
                  type="text"
                  value={form.postalCode}
                  onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">เบอร์โทรศัพท์</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">อีเมลโรงเรียน</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">เว็บไซต์</label>
                <input
                  type="text"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://www.school.ac.th"
                  disabled={isReadOnly}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อผู้อำนวยการ</label>
                <input
                  type="text"
                  value={form.directorName}
                  onChange={(e) => setForm({ ...form, directorName: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ปีการศึกษา</label>
                <input
                  type="text"
                  value={form.academicYear}
                  onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ภาคเรียน</label>
                <input
                  type="text"
                  value={form.semester}
                  onChange={(e) => setForm({ ...form, semester: e.target.value })}
                  disabled={isReadOnly}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                />
              </div>
            </div>
          )}

          {tab === 'branding' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Logo 512x512 */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="text-sm font-bold text-slate-900">โลโก้โรงเรียน (512 × 512 px)</div>
                  <div className="h-36 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                    {form.logoUrl ? (
                      <img src={form.logoUrl} alt="Logo" className="w-28 h-28 object-contain" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-400" />
                    )}
                  </div>
                  <label className="block">
                    <span className="inline-block px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer hover:bg-slate-800">
                      อัปโหลด & ครอปโลโก้
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isReadOnly}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCropTarget({
                            kind: 'logo',
                            file,
                            width: 512,
                            height: 512,
                            title: 'ปรับตำแหน่งโลโก้โรงเรียน',
                          });
                        }
                      }}
                    />
                  </label>
                </div>

                {/* Login Cover 1920x1080 */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="text-sm font-bold text-slate-900">ภาพหน้าปก Login (1920 × 1080 px)</div>
                  <div className="h-36 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden">
                    <img
                      src={form.loginCoverUrl || DEFAULT_BRANDING.loginCoverUrl}
                      alt="Cover"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <label className="block">
                    <span className="inline-block px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer hover:bg-slate-800">
                      อัปโหลด & ครอปภาพปก
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isReadOnly}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCropTarget({
                            kind: 'login-cover',
                            file,
                            width: 1920,
                            height: 1080,
                            title: 'ปรับตำแหน่งภาพหน้าปก Login',
                          });
                        }
                      }}
                    />
                  </label>
                </div>

                {/* Background 1920x1080 */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="text-sm font-bold text-slate-900">ภาพพื้นหลัง (1920 × 1080 px)</div>
                  <div className="h-36 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                    {form.backgroundUrl ? (
                      <img src={form.backgroundUrl} alt="Background" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-slate-400">ใช้พื้นหลังมาตรฐาน</span>
                    )}
                  </div>
                  <label className="block">
                    <span className="inline-block px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer hover:bg-slate-800">
                      อัปโหลด & ครอปพื้นหลัง
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isReadOnly}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCropTarget({
                            kind: 'background',
                            file,
                            width: 1920,
                            height: 1080,
                            title: 'ปรับตำแหน่งภาพพื้นหลัง',
                          });
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                <div className="text-xs font-bold text-slate-800">
                  ชุดสีพาสเทลแนะนำสำหรับโรงเรียน (คลิกเพื่อนำไปใช้ทันที)
                </div>
                <div className="flex flex-wrap gap-2">
                  {PASTEL_THEMES.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={isReadOnly}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          primaryColor: preset.primary,
                          secondaryColor: preset.secondary,
                        }))
                      }
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-white hover:bg-slate-50 text-xs font-medium text-slate-800 transition-colors disabled:opacity-50"
                      style={{
                        borderColor:
                          form.primaryColor.toLowerCase() === preset.primary.toLowerCase()
                            ? preset.primary
                            : '#e2e8f0',
                      }}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white shadow-2xs"
                        style={{
                          background: `linear-gradient(135deg, ${preset.primary} 0%, ${preset.secondary} 100%)`,
                        }}
                      />
                      <span>{preset.nameTh}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">สีหลักประจำโรงเรียน</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.primaryColor}
                      disabled={isReadOnly}
                      onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                      className="w-10 h-10 rounded border border-slate-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={form.primaryColor}
                      disabled={isReadOnly}
                      onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">สีรองประจำโรงเรียน</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.secondaryColor}
                      disabled={isReadOnly}
                      onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                      className="w-10 h-10 rounded border border-slate-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={form.secondaryColor}
                      disabled={isReadOnly}
                      onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">ข้อความต้อนรับหน้า Login</label>
                  <input
                    type="text"
                    value={form.welcomeMessage}
                    disabled={isReadOnly}
                    onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={saving || isReadOnly}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          {/* Invite Member Form */}
          <form onSubmit={handleSendInvite} className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              เชิญสมาชิกเข้าใช้งานภายในโรงเรียน
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              กำหนดบทบาทเป็น ผู้ดูแลโรงเรียน (School Admin), ฝ่ายจัดตาราง (Scheduler) หรือ ครูผู้สอน (Teacher)
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Username ผู้ใช้งาน (เช่น teacher01)"
                disabled={isReadOnly}
                className="sm:col-span-2 px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
                required
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'school_admin' | 'scheduler' | 'teacher')}
                disabled={isReadOnly}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="scheduler">ฝ่ายจัดตาราง (Scheduler)</option>
                <option value="teacher">ครูผู้สอน (Teacher)</option>
                <option value="school_admin">ผู้ดูแลโรงเรียน (School Admin)</option>
              </select>
              <select
                value={inviteTeacherId}
                onChange={(e) => setInviteTeacherId(e.target.value)}
                disabled={isReadOnly}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="">ผูกกับโปรไฟล์ครู (ไม่บังคับ)</option>
                {workspace.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} {t.firstName} {t.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving || isReadOnly}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
              >
                สร้างคำเชิญ & คัดลอกลิงก์
              </button>
            </div>
          </form>

          {/* Members List */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2 font-bold text-slate-900 text-sm">
              <Users className="w-4 h-4" />
              รายชื่อสมาชิกในโรงเรียน ({workspace.members.length} คน)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <tr>
                    <th className="p-3 text-left">ชื่อ-นามสกุล</th>
                    <th className="p-3 text-left">อีเมล</th>
                    <th className="p-3 text-left">บทบาท</th>
                    <th className="p-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.members.map((m) => (
                    <tr key={m.uid} className="border-b border-slate-100 last:border-b-0">
                      <td className="p-3 font-medium text-slate-900">{m.displayName}</td>
                      <td className="p-3 text-slate-600">{m.email}</td>
                      <td className="p-3">
                        <select
                          value={m.role}
                          disabled={isReadOnly || m.uid === currentUser.uid}
                          onChange={(e) => {
                            const nextRole = e.target.value as 'school_admin' | 'scheduler' | 'teacher';
                            void upsertSchoolDoc(school.id, 'members', m.uid, { role: nextRole }, false)
                              .then(() => showToast('อัปเดตบทบาทสมาชิกแล้ว', 'success'))
                              .catch((err) => showToast(formatErrorMessage(err), 'error'));
                          }}
                          className="px-2.5 py-1 rounded border border-slate-300 text-xs bg-white"
                        >
                          <option value="school_admin">School Admin</option>
                          <option value="scheduler">Scheduler</option>
                          <option value="teacher">Teacher</option>
                        </select>
                      </td>
                      <td className="p-3 text-right">
                        {m.uid !== currentUser.uid && (
                          <button
                            type="button"
                            disabled={isReadOnly}
                            onClick={async () => {
                              const ok = await confirmAction({
                                title: 'ลบสมาชิกออกจากโรงเรียน?',
                                description: `ต้องการถอดสิทธิ์ ${m.email} ออกจากโรงเรียนนี้หรือไม่`,
                                danger: true,
                              });
                              if (ok) {
                                await deleteSchoolDoc(school.id, 'members', m.uid);
                                showToast('ลบสมาชิกแล้ว', 'success');
                              }
                            }}
                            className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-40"
                          >
                            ลบสิทธิ์
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Invites */}
          {workspace.invites.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-sm font-bold text-slate-900 mb-3">คำเชิญที่ส่งแล้ว</h3>
              <div className="space-y-2 text-xs">
                {workspace.invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200"
                  >
                    <div>
                      <span className="font-semibold text-slate-900">{inv.email}</span>
                      <span className="text-slate-500 ml-2">· {inv.role} · {inv.status}</span>
                    </div>
                    {inv.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => {
                          const link = `${window.location.origin}/s/${school.slug}/login?invite=${inv.id}`;
                          void navigator.clipboard?.writeText(link);
                          showToast('คัดลอกลิงก์เชิญแล้ว', 'success');
                        }}
                        className="px-3 py-1 bg-white border border-slate-300 rounded font-medium hover:bg-slate-100"
                      >
                        คัดลอกลิงก์
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Crop Modal */}
      {cropTarget && (
        <ImageCropModal
          file={cropTarget.file}
          title={cropTarget.title}
          targetWidth={cropTarget.width}
          targetHeight={cropTarget.height}
          outputMime={cropTarget.kind === 'logo' ? 'image/png' : 'image/webp'}
          onConfirm={(blob) => void handleCroppedUpload(blob)}
          onCancel={() => setCropTarget(null)}
        />
      )}

      {/* Login Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between text-xs">
              <span>พรีวิวหน้า Login ประจำโรงเรียน ({school.slug})</span>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded font-semibold"
              >
                ปิดตัวอย่าง
              </button>
            </div>
            <div
              className="p-6 sm:p-10 bg-slate-100 bg-cover bg-center"
              style={form.backgroundUrl ? { backgroundImage: `url(${form.backgroundUrl})` } : undefined}
            >
              <div className="bg-white rounded-xl overflow-hidden grid grid-cols-1 md:grid-cols-2 border border-slate-200 shadow-lg">
                <div className="relative p-6 text-white min-h-[260px] flex flex-col justify-between bg-slate-900">
                  <img
                    src={form.loginCoverUrl || DEFAULT_BRANDING.loginCoverUrl}
                    alt="Login Cover Preview"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(180deg, ${form.primaryColor}aa 0%, #0f172ae6 100%)`,
                    }}
                  />
                  <div className="relative z-10 flex items-center gap-3">
                    {form.logoUrl ? (
                      <img src={form.logoUrl} alt="Logo" className="w-10 h-10 rounded-lg bg-white p-0.5 object-contain" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-white text-slate-900 font-bold flex items-center justify-center">
                        {form.nameTh.slice(0, 2)}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-sm">{form.nameTh}</div>
                      <div className="text-[11px] text-white/80">{form.nameEn}</div>
                    </div>
                  </div>
                  <div className="relative z-10 text-sm font-semibold">
                    {form.welcomeMessage || DEFAULT_BRANDING.welcomeMessage}
                  </div>
                </div>
                <div className="p-6 flex flex-col justify-center space-y-3">
                  <div className="font-bold text-base text-slate-900">เข้าสู่ระบบ</div>
                  <div className="h-9 rounded-lg border border-slate-300 bg-slate-50" />
                  <div className="h-9 rounded-lg border border-slate-300 bg-slate-50" />
                  <div
                    className="h-9 rounded-lg text-white text-xs font-semibold flex items-center justify-center"
                    style={{ backgroundColor: form.primaryColor }}
                  >
                    เข้าสู่ระบบโรงเรียน
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
