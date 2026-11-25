import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Palette, RotateCcw, Sparkles, SlidersHorizontal, X } from 'lucide-react';
import { PASTEL_THEMES, useTheme } from '../../contexts/ThemeContext';

const QUICK_CUSTOM_PASTELS = [
  { label: 'เบบี้บลู', primary: '#5A8DEE', secondary: '#9AC6FA' },
  { label: 'ซากุระ', primary: '#D86B8B', secondary: '#F7B2C6' },
  { label: 'มัทฉะ', primary: '#4D9078', secondary: '#9BD3BD' },
  { label: 'ไลแลค', primary: '#8A6BE0', secondary: '#C4B3FA' },
  { label: 'แอปริคอต', primary: '#D97B48', secondary: '#F9BD99' },
];

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, prefs, selectPreset, setCustomColors, toggleEffects, resetTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all whitespace-nowrap shrink-0 shadow-xs hover:shadow-sm bg-white/90 text-slate-800"
        style={{ borderColor: theme.border }}
        aria-label="เลือกธีมและโทนสีพาสเทล"
      >
        <span
          className="w-3.5 h-3.5 rounded-full border border-white shadow-xs shrink-0"
          style={{
            background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
          }}
        />
        <Palette className="w-3.5 h-3.5 shrink-0" style={{ color: theme.primary }} />
        {!compact && <span>เลือกธีม · {theme.nameTh}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute right-0 mt-2 w-80 sm:w-[360px] rounded-2xl border bg-white/95 backdrop-blur-md shadow-xl p-4 z-50 space-y-4"
            style={{ borderColor: theme.border }}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: theme.pastelSoft, color: theme.primary }}
                >
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">ปรับแต่งธีมและสีพาสเทล</div>
                  <div className="text-[11px] text-slate-500">เลือกโทนสีที่ชอบและเอฟเฟกต์หน้าจอ</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                aria-label="ปิดหน้าต่างเลือกธีม"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 6 Pastel Presets */}
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-2">ชุดสีพาสเทลแนะนำ</div>
              <div className="grid grid-cols-2 gap-2">
                {PASTEL_THEMES.map((preset) => {
                  const active = prefs.themeId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => selectPreset(preset.id)}
                      className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition-all ${
                        active ? 'ring-2 shadow-xs' : 'hover:bg-slate-50'
                      }`}
                      style={{
                        borderColor: active ? preset.primary : '#e2e8f0',
                        backgroundColor: active ? preset.pastelAlt : '#ffffff',
                        boxShadow: active ? `0 0 0 1px ${preset.primary}33` : undefined,
                      }}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{preset.nameTh}</div>
                        <div className="flex items-center gap-1 mt-1">
                          {preset.swatches.map((color, idx) => (
                            <span
                              key={idx}
                              className="w-3.5 h-3.5 rounded-full border border-white shadow-2xs"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                      {active && (
                        <div
                          className="w-5 h-5 rounded-full text-white flex items-center justify-center shrink-0"
                          style={{ backgroundColor: preset.primary }}
                        >
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Pastel Mixer */}
            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: theme.primary }} />
                  ผสมสีพาสเทลเอง
                </span>
                {prefs.themeId === 'custom' && (
                  <span className="text-[11px] font-semibold" style={{ color: theme.primary }}>
                    กำลังใช้งานสีปรับเอง
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {QUICK_CUSTOM_PASTELS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setCustomColors(chip.primary, chip.secondary)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50/80 hover:bg-white text-[11px] font-medium text-slate-700 transition-colors"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: chip.primary }}
                    />
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer">
                  <input
                    type="color"
                    value={prefs.themeId === 'custom' ? prefs.customPrimary : theme.primary}
                    onChange={(e) => setCustomColors(e.target.value, theme.secondary)}
                    className="w-7 h-7 rounded-md border border-slate-200 cursor-pointer shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-800">สีหลัก</div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase truncate">
                      {theme.primary}
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer">
                  <input
                    type="color"
                    value={prefs.themeId === 'custom' ? prefs.customSecondary : theme.secondary}
                    onChange={(e) => setCustomColors(theme.primary, e.target.value)}
                    className="w-7 h-7 rounded-md border border-slate-200 cursor-pointer shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-800">สีไฮไลต์พาสเทล</div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase truncate">
                      {theme.secondary}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Effects Toggle & Reset */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => toggleEffects()}
                className="flex items-center gap-2 text-xs font-medium text-slate-700 hover:text-slate-900"
              >
                <Sparkles
                  className="w-4 h-4"
                  style={{ color: theme.effectsEnabled ? theme.primary : '#94a3b8' }}
                />
                <span>เอฟเฟกต์กระจก & ไล่เฉดพาสเทล</span>
                <span
                  className={`ml-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    theme.effectsEnabled
                      ? 'text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                  style={theme.effectsEnabled ? { backgroundColor: theme.primary } : undefined}
                >
                  {theme.effectsEnabled ? 'เปิด' : 'ปิด'}
                </span>
              </button>

              <button
                type="button"
                onClick={resetTheme}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                title="รีเซ็ตค่าเริ่มต้น"
              >
                <RotateCcw className="w-3 h-3" />
                <span>ค่าเดิม</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
