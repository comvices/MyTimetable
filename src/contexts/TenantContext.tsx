import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OperationType, handleFirestoreError } from '../lib/firestoreError';
import {
  DEFAULT_BRANDING,
  getDaysRemaining,
  isSchoolReadOnly,
  resolveTenantSlugFromLocation,
} from '../lib/tenant';
import {
  DEFAULT_PLANS,
  DEFAULT_PLATFORM_SETTINGS,
  Plan,
  PlanFeatureKey,
  PlatformSettings,
  School,
  SchoolMember,
  SchoolSlugBranding,
} from '../types/saas';
import { useAuth } from './AuthContext';

export type PreviewSchoolRole = 'school_admin' | 'scheduler' | 'teacher';
export type EffectiveSchoolRole = 'super_admin' | PreviewSchoolRole;

interface TenantContextValue {
  tenantSlug: string | null;
  publicBranding: SchoolSlugBranding | null;
  school: School | null;
  member: SchoolMember | null;
  plans: Plan[];
  currentPlan: Plan;
  platformSettings: PlatformSettings;
  loadingTenant: boolean;
  isReadOnly: boolean;
  daysRemaining: number | null;
  previewRole: PreviewSchoolRole | null;
  previewTeacherId: string | null;
  effectiveSchoolRole: EffectiveSchoolRole;
  setPreviewPersona: (role: PreviewSchoolRole | null, teacherId?: string | null) => void;
  hasFeature: (feature: PlanFeatureKey) => boolean;
  refreshTenant: () => Promise<void>;
  setActiveSchoolById: (schoolId: string | null) => Promise<void>;
}

const SESSION_SCHOOL_KEY = 'kruschedule_override_school_id';
const SESSION_PREVIEW_ROLE_KEY = 'kruschedule_preview_role';
const SESSION_PREVIEW_TEACHER_KEY = 'kruschedule_preview_teacher_id';

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { currentUser, userProfile, authReady, isSuperAdmin } = useAuth();

  const [tenantSlug, setTenantSlug] = useState<string | null>(() =>
    resolveTenantSlugFromLocation(window.location.pathname, window.location.search)
  );
  const [publicBranding, setPublicBranding] = useState<SchoolSlugBranding | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [member, setMember] = useState<SchoolMember | null>(null);
  const [plans, setPlans] = useState<Plan[]>(DEFAULT_PLANS);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [loadingTenant, setLoadingTenant] = useState(true);
  const [overrideSchoolId, setOverrideSchoolId] = useState<string | null>(() => {
    try {
      return window.sessionStorage.getItem(SESSION_SCHOOL_KEY);
    } catch {
      return null;
    }
  });
  const [previewRole, setPreviewRole] = useState<PreviewSchoolRole | null>(() => {
    try {
      const val = window.sessionStorage.getItem(SESSION_PREVIEW_ROLE_KEY);
      if (val === 'school_admin' || val === 'scheduler' || val === 'teacher') return val;
      return null;
    } catch {
      return null;
    }
  });
  const [previewTeacherId, setPreviewTeacherId] = useState<string | null>(() => {
    try {
      return window.sessionStorage.getItem(SESSION_PREVIEW_TEACHER_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!currentUser) {
      setOverrideSchoolId(null);
      setPreviewRole(null);
      setPreviewTeacherId(null);
      try {
        window.sessionStorage.removeItem(SESSION_SCHOOL_KEY);
        window.sessionStorage.removeItem(SESSION_PREVIEW_ROLE_KEY);
        window.sessionStorage.removeItem(SESSION_PREVIEW_TEACHER_KEY);
      } catch {
        // Ignore storage errors
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (authReady && !isSuperAdmin && previewRole !== null) {
      setPreviewRole(null);
      setPreviewTeacherId(null);
    }
  }, [authReady, isSuperAdmin, previewRole]);

  useEffect(() => {
    const resolved = resolveTenantSlugFromLocation(location.pathname, location.search);
    setTenantSlug(resolved);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const primary = school?.primaryColor || publicBranding?.primaryColor || DEFAULT_BRANDING.primaryColor;
    const secondary = school?.secondaryColor || publicBranding?.secondaryColor || DEFAULT_BRANDING.secondaryColor;
    document.documentElement.style.setProperty('--brand-primary', primary);
    document.documentElement.style.setProperty('--brand-secondary', secondary);
  }, [school, publicBranding]);

  const loadPlatformGlobals = useCallback(async () => {
    try {
      const [plansSnap, settingsSnap] = await Promise.all([
        getDocs(query(collection(db, 'plans'), where('isActive', '==', true))),
        getDoc(doc(db, 'platformSettings', 'global')),
      ]);
      if (!plansSnap.empty) {
        const fetchedMap = new Map(plansSnap.docs.map((d) => [d.id, d.data() as Plan]));
        const merged = DEFAULT_PLANS.map((defPlan) => {
          const remote = fetchedMap.get(defPlan.id);
          if (remote && remote.isActive !== false) {
            return {
              ...defPlan,
              ...remote,
              priceAnnual: remote.priceAnnual ?? defPlan.priceAnnual,
              maxTeachers: remote.maxTeachers ?? defPlan.maxTeachers,
            };
          }
          return defPlan;
        });
        setPlans(merged.filter((p) => p.isActive));
      } else {
        setPlans(DEFAULT_PLANS);
      }
      if (settingsSnap.exists()) {
        setPlatformSettings(settingsSnap.data() as PlatformSettings);
      }
    } catch {
      setPlans(DEFAULT_PLANS);
    }
  }, []);

  const loadTenant = useCallback(async () => {
    setLoadingTenant(true);
    await loadPlatformGlobals();

    try {
      let targetSchoolId = overrideSchoolId || null;

      if (tenantSlug) {
        try {
          const slugSnap = await getDoc(doc(db, 'schoolSlugs', tenantSlug));
          if (slugSnap.exists()) {
            const branding = slugSnap.data() as SchoolSlugBranding;
            setPublicBranding(branding);
            targetSchoolId = branding.schoolId;
          } else {
            setPublicBranding(null);
          }
        } catch {
          setPublicBranding(null);
        }
      } else {
        setPublicBranding(null);
      }

      if (!authReady || !currentUser) {
        setSchool(null);
        setMember(null);
        setLoadingTenant(false);
        return;
      }

      if (!targetSchoolId && userProfile?.schoolId) {
        targetSchoolId = userProfile.schoolId;
      }

      if (!targetSchoolId) {
        try {
          const ownedSnap = await getDocs(
            query(collection(db, 'schools'), where('ownerUid', '==', currentUser.uid), limit(1))
          );
          if (!ownedSnap.empty) {
            targetSchoolId = ownedSnap.docs[0].id;
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, 'schools');
        }
      }

      if (!targetSchoolId) {
        setSchool(null);
        setMember(null);
        setLoadingTenant(false);
        return;
      }

      try {
        const schoolSnap = await getDoc(doc(db, 'schools', targetSchoolId));
        if (!schoolSnap.exists()) {
          setSchool(null);
          setMember(null);
          return;
        }
        setSchool(schoolSnap.data() as School);

        const memberSnap = await getDoc(
          doc(db, 'schools', targetSchoolId, 'members', currentUser.uid)
        );
        setMember(memberSnap.exists() ? (memberSnap.data() as SchoolMember) : null);
      } catch {
        setSchool(null);
        setMember(null);
      }
    } finally {
      setLoadingTenant(false);
    }
  }, [tenantSlug, overrideSchoolId, authReady, currentUser, userProfile?.schoolId, loadPlatformGlobals]);

  useEffect(() => {
    void loadTenant();
  }, [loadTenant]);

  const setActiveSchoolById = async (schoolId: string | null) => {
    setOverrideSchoolId(schoolId);
    try {
      if (schoolId) {
        window.sessionStorage.setItem(SESSION_SCHOOL_KEY, schoolId);
      } else {
        window.sessionStorage.removeItem(SESSION_SCHOOL_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  };

  const setPreviewPersona = (role: PreviewSchoolRole | null, teacherId: string | null = null) => {
    if (!isSuperAdmin) return;
    setPreviewRole(role);
    setPreviewTeacherId(teacherId);
    try {
      if (role) {
        window.sessionStorage.setItem(SESSION_PREVIEW_ROLE_KEY, role);
      } else {
        window.sessionStorage.removeItem(SESSION_PREVIEW_ROLE_KEY);
      }
      if (teacherId) {
        window.sessionStorage.setItem(SESSION_PREVIEW_TEACHER_KEY, teacherId);
      } else {
        window.sessionStorage.removeItem(SESSION_PREVIEW_TEACHER_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  };

  const effectiveSchoolRole: EffectiveSchoolRole = isSuperAdmin
    ? previewRole || 'super_admin'
    : member?.role || currentUser?.role || 'teacher';

  const currentPlan =
    plans.find((p) => p.id === (school?.planId || 'professional')) ||
    DEFAULT_PLANS.find((p) => p.id === (school?.planId || 'professional')) ||
    DEFAULT_PLANS[1];

  const isReadOnly = isSchoolReadOnly(school);
  const daysRemaining = getDaysRemaining(school);

  const hasFeature = (feature: PlanFeatureKey) => {
    if (isSuperAdmin) return true;
    return currentPlan.features.includes(feature);
  };

  return (
    <TenantContext.Provider
      value={{
        tenantSlug,
        publicBranding,
        school,
        member,
        plans,
        currentPlan,
        platformSettings,
        loadingTenant,
        isReadOnly,
        daysRemaining,
        previewRole,
        previewTeacherId,
        effectiveSchoolRole,
        setPreviewPersona,
        hasFeature,
        refreshTenant: loadTenant,
        setActiveSchoolById,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
