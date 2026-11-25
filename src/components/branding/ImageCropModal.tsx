import React, { useEffect, useRef, useState } from 'react';
import { Move, X, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageCropModalProps {
  file: File;
  title: string;
  targetWidth: number;
  targetHeight: number;
  outputMime?: 'image/png' | 'image/webp';
  onConfirm: (blob: Blob, previewUrl: string) => void;
  onCancel: () => void;
}

export function ImageCropModal({
  file,
  title,
  targetWidth,
  targetHeight,
  outputMime = 'image/webp',
  onConfirm,
  onCancel,
}: ImageCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const previewW = targetWidth === targetHeight ? 320 : 480;
  const previewH = Math.round((previewW * targetHeight) / targetWidth);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgEl) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, previewW, previewH);
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, previewW, previewH);

    const baseScale = Math.max(previewW / imgEl.width, previewH / imgEl.height);
    const drawW = imgEl.width * baseScale * zoom;
    const drawH = imgEl.height * baseScale * zoom;
    const drawX = (previewW - drawW) / 2 + offset.x;
    const drawY = (previewH - drawH) / 2 + offset.y;

    ctx.drawImage(imgEl, drawX, drawY, drawW, drawH);
  }, [imgEl, zoom, offset, previewW, previewH]);

  const handleSave = () => {
    if (!imgEl) return;
    // Scale output cleanly while keeping document size reasonable (<500KB when fallback Data URL is needed)
    const outCanvas = document.createElement('canvas');
    const maxExportW = targetWidth > 1280 ? 1280 : targetWidth;
    const maxExportH = Math.round((maxExportW * targetHeight) / targetWidth);
    outCanvas.width = maxExportW;
    outCanvas.height = maxExportH;

    const ctx = outCanvas.getContext('2d');
    if (!ctx) return;

    const ratio = maxExportW / previewW;
    const baseScale = Math.max(previewW / imgEl.width, previewH / imgEl.height);
    const drawW = imgEl.width * baseScale * zoom * ratio;
    const drawH = imgEl.height * baseScale * zoom * ratio;
    const drawX = (maxExportW - drawW) / 2 + offset.x * ratio;
    const drawY = (maxExportH - drawH) / 2 + offset.y * ratio;

    ctx.drawImage(imgEl, drawX, drawY, drawW, drawH);
    outCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const previewUrl = outCanvas.toDataURL(outputMime, 0.86);
        onConfirm(blob, previewUrl);
      },
      outputMime,
      0.86
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="bg-white rounded-xl border border-slate-200 max-w-xl w-full p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">
              ขนาดแนะนำ {targetWidth} × {targetHeight} px · ลากเพื่อจัดตำแหน่งภาพ
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          <canvas
            ref={canvasRef}
            width={previewW}
            height={previewH}
            onMouseDown={(e) => {
              setDragging(true);
              setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
            }}
            onMouseMove={(e) => {
              if (!dragging) return;
              setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
            }}
            onMouseUp={() => setDragging(false)}
            onMouseLeave={() => setDragging(false)}
            className="rounded-lg border border-slate-300 cursor-move max-w-full"
          />

          <div className="mt-4 w-full flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-slate-500" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-slate-900"
            />
            <ZoomIn className="w-4 h-4 text-slate-500" />
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md"
            >
              <Move className="w-3.5 h-3.5" />
              รีเซ็ต
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
          >
            ใช้ภาพนี้
          </button>
        </div>
      </div>
    </div>
  );
}
