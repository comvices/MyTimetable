import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type PastelThemeId = 'sky' | 'mint' | 'lavender' | 'peach' | 'buttercup' | 'sage' | 'custom';

export interface PastelThemePreset {
  id: Exclude<PastelThemeId, 'custom'>;
  nameTh: string;
  nameEn: string;
  canvas: string;
  surface: string;
  pastelSoft: string;
  pastelAlt: string;
  primary: string;
  secondary: string;
  border: string;
  swatches: [string, string, string];
}

export const PASTEL_THEMES: PastelThemePreset[] = [
  {
    id: 'sky',
    nameTh: 'ฟ้าพาสเทล',
    nameEn: 'Sky Breeze',
    canvas: '#F4F9FF',
    surface: '#FFFFFF',
    pastelSoft: '#E3F0FF',
    pastelAlt: '#EEF5FF',
    primary: '#4A7BD0',
    secondary: '#7DB2F0',
    border: '#D6E6FB',
    swatches: ['#A8D1FF', '#CBE4FF', '#4A7BD0'],
  },
  {
    id: 'mint',
    nameTh: 'เขียวมิ้นต์',
    nameEn: 'Mint Blossom',
    canvas: '#F2FBF8',
    surface: '#FFFFFF',
    pastelSoft: '#DCF7EE',
    pastelAlt: '#E9FBF5',
    primary: '#2E8B71',
    secondary: '#6DC9AE',
    border: '#C9EFE2',
    swatches: ['#9AE6CD', '#D2F7EA', '#2E8B71'],
  },
  {
    id: 'lavender',
    nameTh: 'ม่วงลาเวนเดอร์',
    nameEn: 'Lavender Mist',
    canvas: '#F8F5FF',
    surface: '#FFFFFF',
    pastelSoft: '#EDE6FF',
    pastelAlt: '#F4EEFF',
    primary: '#7858C4',
    secondary: '#AE93EB',
    border: '#E2D8FA',
    swatches: ['#C8B6FF', '#EAE2FF', '#7858C4'],
  },
  {
    id: 'peach',
    nameTh: 'พีชโรส',
    nameEn: 'Peach Blossom',
    canvas: '#FFF7F8',
    surface: '#FFFFFF',
    pastelSoft: '#FFE8EC',
    pastelAlt: '#FFF1E8',
    primary: '#C95D75',
    secondary: '#F29CA9',
    border: '#FAD8DE',
    swatches: ['#FFB8C6', '#FFE1D6', '#C95D75'],
  },
  {
    id: 'buttercup',
    nameTh: 'ครีมวานิลลา',
    nameEn: 'Honey Cream',
    canvas: '#FFFAF2',
    surface: '#FFFFFF',
    pastelSoft: '#FFF0D4',
    pastelAlt: '#FFF6E3',
    primary: '#B57428',
    secondary: '#E6B36A',
    border: '#F7E3BD',
    swatches: ['#FFD89C', '#FFF0CC', '#B57428'],
  },
  {
    id: 'sage',
    nameTh: 'เซจมินิมอล',
    nameEn: 'Soft Sage',
    canvas: '#F5F8F6',
    surface: '#FFFFFF',
    pastelSoft: '#E2EEE7',
    pastelAlt: '#EDF5F0',
    primary: '#4B7D65',
    secondary: '#87B59E',
    border: '#D4E4DA',
    swatches: ['#A8D1BC', '#DFECE5', '#4B7D65'],
  },
];

interface ThemePreferences {
  themeId: PastelThemeId;
  customPrimary: string;
  customSecondary: string;
  customSoft: string;
  effectsEnabled: boolean;
}

const STORAGE_KEY = 'kruschedule_theme_v1';

const DEFAULT_PREFS: ThemePreferences = {
  themeId: 'sky',
  customPrimary: '#6E7FE8',
  customSecondary: '#F2A7C3',
  customSoft: '#ECEEFF',
  effectsEnabled: true,
};

function hexToRgbTuple(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '74, 123, 208';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '74, 123, 208';
  return `${r}, ${g}, ${b}`;
}

function mixWithWhite(hex: string, ratio: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#EEF5FF';
  const r = Math.round(parseInt(clean.slice(0, 2), 16) * (1 - ratio) + 255 * ratio);
  const g = Math.round(parseInt(clean.slice(2, 4), 16) * (1 - ratio) + 255 * ratio);
  const b = Math.round(parseInt(clean.slice(4, 6), 16) * (1 - ratio) + 255 * ratio);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export interface ActiveThemeTokens {
  themeId: PastelThemeId;
  nameTh: string;
  canvas: string;
  surface: string;
  pastelSoft: string;
  pastelAlt: string;
  primary: string;
  secondary: string;
  border: string;
  effectsEnabled: boolean;
}

interface ThemeContextValue {
  theme: ActiveThemeTokens;
  prefs: ThemePreferences;
  selectPreset: (id: Exclude<PastelThemeId, 'custom'>) => void;
  setCustomColors: (primary: string, secondary: string) => void;
  toggleEffects: (enabled?: boolean) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<ThemePreferences>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_PREFS;
      const parsed = JSON.parse(raw) as Partial<ThemePreferences>;
      return {
        themeId: parsed.themeId || 'sky',
        customPrimary: parsed.customPrimary || DEFAULT_PREFS.customPrimary,
        customSecondary: parsed.customSecondary || DEFAULT_PREFS.customSecondary,
        customSoft: parsed.customSoft || DEFAULT_PREFS.customSoft,
        effectsEnabled: parsed.effectsEnabled !== undefined ? parsed.effectsEnabled : true,
      };
    } catch {
      return DEFAULT_PREFS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage quota errors
    }
  }, [prefs]);

  const theme = useMemo<ActiveThemeTokens>(() => {
    if (prefs.themeId === 'custom') {
      const soft = mixWithWhite(prefs.customPrimary, 0.86);
      const alt = mixWithWhite(prefs.customSecondary, 0.86);
      const canvas = mixWithWhite(prefs.customPrimary, 0.94);
      const border = mixWithWhite(prefs.customPrimary, 0.75);
      return {
        themeId: 'custom',
        nameTh: 'พาสเทลปรับแต่งเอง',
        canvas,
        surface: '#FFFFFF',
        pastelSoft: soft,
        pastelAlt: alt,
        primary: prefs.customPrimary,
        secondary: prefs.customSecondary,
        border,
        effectsEnabled: prefs.effectsEnabled,
      };
    }
    const preset = PASTEL_THEMES.find((p) => p.id === prefs.themeId) || PASTEL_THEMES[0];
    return {
      themeId: preset.id,
      nameTh: preset.nameTh,
      canvas: preset.canvas,
      surface: preset.surface,
      pastelSoft: preset.pastelSoft,
      pastelAlt: preset.pastelAlt,
      primary: preset.primary,
      secondary: preset.secondary,
      border: preset.border,
      effectsEnabled: prefs.effectsEnabled,
    };
  }, [prefs]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--theme-canvas', theme.canvas);
    root.style.setProperty('--theme-surface', theme.surface);
    root.style.setProperty('--theme-pastel-soft', theme.pastelSoft);
    root.style.setProperty('--theme-pastel-alt', theme.pastelAlt);
    root.style.setProperty('--theme-primary', theme.primary);
    root.style.setProperty('--theme-primary-rgb', hexToRgbTuple(theme.primary));
    root.style.setProperty('--theme-secondary', theme.secondary);
    root.style.setProperty('--theme-secondary-rgb', hexToRgbTuple(theme.secondary));
    root.style.setProperty('--theme-border', theme.border);
    root.dataset.effects = theme.effectsEnabled ? 'on' : 'off';
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      prefs,
      selectPreset: (id) => setPrefs((prev) => ({ ...prev, themeId: id })),
      setCustomColors: (primary, secondary) =>
        setPrefs((prev) => ({
          ...prev,
          themeId: 'custom',
          customPrimary: primary,
          customSecondary: secondary,
          customSoft: mixWithWhite(primary, 0.86),
        })),
      toggleEffects: (enabled) =>
        setPrefs((prev) => ({
          ...prev,
          effectsEnabled: enabled !== undefined ? enabled : !prev.effectsEnabled,
        })),
      resetTheme: () => setPrefs(DEFAULT_PREFS),
    }),
    [theme, prefs]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return ctx;
}
