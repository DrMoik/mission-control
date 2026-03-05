// ─── ImageCropModal ───────────────────────────────────────────────────────────
// Canvas-based WYSIWYG image cropper.
//
// How it works:
//  1. The source image is drawn onto a <canvas> at `fitScale * userZoom`.
//     `fitScale` is calculated once on load so the image always "covers" the
//     frame at 1× zoom (similar to CSS object-fit: cover).
//  2. The user drags to reposition and scrolls / uses the slider to zoom.
//  3. On "Apply", the same draw parameters are used to extract the exact
//     visible region from the original image into an output canvas, which is
//     returned as a data: URL via `onApply`.
//
// Props:
//  src         – URL of the image to crop
//  cropWidth   – output pixel width  (default 240)
//  cropHeight  – output pixel height (default 240)
//  label       – heading text shown above the canvas
//  onApply(url)– called with the cropped data URL (or original src on CORS fail)
//  onCancel()  – called when the user cancels

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../strings.js';
import { isBlockedImageHost, isNoCorsImageHost } from '../utils.js';

export default function ImageCropModal({
  src,
  onApply,
  onCancel,
  cropWidth  = 240,
  cropHeight = 240,
  label      = 'Reframe Image',
  focusTop   = false,  // when true, initial crop favors top (face/head) for portrait photos
}) {

  // Refs
  const previewRef    = React.useRef(null); // visible <canvas>
  const imgRef        = React.useRef(null); // loaded HTMLImageElement
  const dragOriginRef = React.useRef(null);
  const rafRef        = React.useRef(null);

  // State
  const [fitScale, setFitScale] = useState(1);   // scale where image fills the frame (cover)
  const [userZoom, setUserZoom] = useState(1);    // multiplier on top of fitScale
  const [offset,   setOffset]   = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [status,   setStatus]   = useState('loading'); // 'loading' | 'ready' | 'error'

  // ── Internal canvas resolution ───────────────────────────────────────────
  // We cap the canvas at MAX_VP px wide so it always fits inside the modal.
  // CSS display is further constrained with max-width:100% / aspect-ratio.
  const MAX_VP = 480;
  const vpRatio = Math.min(1, MAX_VP / cropWidth);
  const vpW = Math.round(cropWidth  * vpRatio);
  const vpH = Math.round(cropHeight * vpRatio);

  const actualScale = fitScale * userZoom;

  /** Returns how many canvas-pixels equal one CSS pixel (> 1 when CSS-scaled down). */
  const getCssScale = () => {
    const rect = previewRef.current?.getBoundingClientRect();
    return rect && rect.width > 0 ? vpW / rect.width : 1;
  };

  // ── Load image ────────────────────────────────────────────────────────────
  // For data: URLs we don't set crossOrigin (canvas export works).
  // For http(s) URLs we set crossOrigin = 'anonymous' so the canvas is not tainted
  // and handleApply can produce a new data URL; if the server doesn't send CORS
  // the image will fail to load and we show error.
  // For Reddit etc. (isNoCorsImageHost): skip crossOrigin so the image loads and displays;
  // Apply will catch tainted canvas and return the original URL.
  useEffect(() => {
    setStatus('loading');
    imgRef.current = null;

    const img = new Image();
    const isDataUrl = typeof src === 'string' && (src.startsWith('data:') || src.startsWith('blob:'));
    const isHttp = typeof src === 'string' && (src.startsWith('http://') || src.startsWith('https://'));
    if (!isDataUrl && isHttp && !isNoCorsImageHost(src)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      imgRef.current = img;
      const fs = Math.max(vpW / img.naturalWidth, vpH / img.naturalHeight);
      setFitScale(fs);
      setUserZoom(1);
      const initialY = focusTop && img.naturalHeight > img.naturalWidth ? vpH * 0.2 : 0;
      setOffset({ x: 0, y: initialY });
      setStatus('ready');
    };
    img.onerror = () => setStatus('error');
    img.src = src;
  }, [src, vpW, vpH, focusTop]);

  // ── Draw preview canvas ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = previewRef.current;
    const img    = imgRef.current;
    if (!canvas || !img || status !== 'ready') return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, vpW, vpH);

      // Draw image centred + offset
      const dw = img.naturalWidth  * actualScale;
      const dh = img.naturalHeight * actualScale;
      const x  = vpW / 2 - dw / 2 + offset.x;
      const y  = vpH / 2 - dh / 2 + offset.y;
      ctx.drawImage(img, x, y, dw, dh);

      // Rule-of-thirds grid overlay
      ctx.strokeStyle = 'rgba(16,185,129,0.35)';
      ctx.lineWidth   = 1;
      [
        [vpW/3, 0, vpW/3, vpH], [2*vpW/3, 0, 2*vpW/3, vpH],
        [0, vpH/3, vpW, vpH/3], [0, 2*vpH/3, vpW, 2*vpH/3],
      ].forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      });

      // Border
      ctx.strokeStyle = 'rgba(16,185,129,0.8)';
      ctx.lineWidth   = 2;
      ctx.strokeRect(1, 1, vpW - 2, vpH - 2);
    });
  }, [status, actualScale, offset, vpW, vpH]);

  // ── Global drag listeners ─────────────────────────────────────────────────
  // Mouse deltas arrive in CSS pixels; we multiply by cssScale to get canvas pixels.
  useEffect(() => {
    if (!dragging) return;
    const move = (e) => {
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      const o  = dragOriginRef.current;
      if (!o) return;
      setOffset({
        x: o.offsetX + (cx - o.mouseX) * o.cssScale,
        y: o.offsetY + (cy - o.mouseY) * o.cssScale,
      });
    };
    const up = () => setDragging(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup',   up);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend',  up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup',   up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend',  up);
    };
  }, [dragging]);

  const startDrag = (cx, cy) => {
    dragOriginRef.current = {
      mouseX:  cx, mouseY:  cy,
      offsetX: offset.x, offsetY: offset.y,
      cssScale: getCssScale(), // capture at drag start so it stays stable
    };
    setDragging(true);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const rect   = previewRef.current?.getBoundingClientRect();
    const factor = e.deltaY < 0 ? 1.07 : 1 / 1.07;
    setUserZoom((z) => Math.min(8, Math.max(0.2, z * factor)));
    if (rect) {
      const cs = vpW / rect.width; // CSS→canvas scale
      // Cursor position in canvas-pixel space, relative to canvas centre
      const cx = (e.clientX - rect.left  - rect.width  / 2) * cs;
      const cy = (e.clientY - rect.top   - rect.height / 2) * cs;
      setOffset((o) => ({
        x: o.x - cx * (factor - 1),
        y: o.y - cy * (factor - 1),
      }));
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────
  // The preview draws: ctx.drawImage(img, x, y, dw, dh) in canvas-pixel space.
  // To export, we map those canvas coordinates back to source-image pixels:
  //   srcX = -x / actualScale
  //   srcW = vpW / actualScale
  // Then we draw that source region into the output canvas at cropWidth×cropHeight.
  const handleApply = () => {
    const img = imgRef.current;
    if (!img) { onApply(src); return; }

    const dw = img.naturalWidth  * actualScale;
    const dh = img.naturalHeight * actualScale;
    const x  = vpW / 2 - dw / 2 + offset.x;
    const y  = vpH / 2 - dh / 2 + offset.y;

    const srcX = -x / actualScale;
    const srcY = -y / actualScale;
    const srcW =  vpW / actualScale;
    const srcH =  vpH / actualScale;

    try {
      const out = document.createElement('canvas');
      out.width  = cropWidth;
      out.height = cropHeight;
      out.getContext('2d').drawImage(img, srcX, srcY, srcW, srcH, 0, 0, cropWidth, cropHeight);
      // JPEG with quality 0.9 — compact enough for Firestore, good visual quality
      const dataUrl = out.toDataURL('image/jpeg', 0.9);
      onApply(dataUrl);
    } catch {
      // CORS blocked on the source — return the original URL unchanged
      onApply(src);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      e.stopPropagation();
      onCancel();
    }
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const modalContent = (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-slate-800 rounded-2xl p-5 w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white font-semibold mb-1 text-sm">{label}</h3>
        <p className="text-[11px] text-slate-400 mb-3">{t('drag_instruction')}</p>

        {/* Preview canvas — internal resolution vpW×vpH; CSS max-width prevents overflow */}
        <canvas
          ref={previewRef}
          width={vpW}
          height={vpH}
          className="rounded-xl bg-slate-900 block select-none mx-auto"
          style={{
            cursor:      dragging ? 'grabbing' : 'grab',
            maxWidth:    '100%',
            aspectRatio: `${vpW} / ${vpH}`,
            height:      'auto',
          }}
          onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
          onTouchStart={(e) => { e.preventDefault(); startDrag(e.touches[0].clientX, e.touches[0].clientY); }}
          onWheel={handleWheel}
        />

        {status === 'loading' && (
          <p className="text-center text-slate-500 text-xs mt-2">{t('image_loading_msg')}</p>
        )}
        {status === 'error' && (
          <div className="text-center mt-2 space-y-2">
            <p className="text-amber-400 text-xs">
              {src && isBlockedImageHost(src) ? t('image_forbidden_url') : t('image_error_msg')}
            </p>
            {src && isBlockedImageHost(src) && (
              <p className="text-slate-500 text-[10px]">{t('image_blocked_host')}</p>
            )}
            {src && (src.startsWith('http://') || src.startsWith('https://')) && (
              <button
                type="button"
                onClick={() => onApply(src)}
                className="text-xs text-emerald-400 hover:text-emerald-300 underline"
              >
                {t('image_use_url')}
              </button>
            )}
          </div>
        )}

        {/* Zoom slider */}
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>{t('zoom_label')}</span>
            <span>{userZoom.toFixed(2)}×</span>
          </div>
          <input
            type="range" min={0.2} max={8} step={0.01}
            value={userZoom}
            onChange={(e) => setUserZoom(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={() => onApply('')}
            className="py-2 px-3 bg-slate-600 hover:bg-slate-500 text-slate-300 text-sm rounded-lg transition-colors"
            title={t('remove_image')}
          >
            {t('remove_image')}
          </button>
          <button
            onClick={handleApply}
            disabled={status !== 'ready'}
            className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-semibold text-sm rounded-lg transition-colors"
          >
            {t('apply_btn')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
