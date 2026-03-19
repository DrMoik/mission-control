import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerSrc;

export default function PdfReader({
  src = '',
  initialPage = 1,
  title = 'PDF',
  onPageChange,
}) {
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const pdfRef = useRef(null);
  const lastNotifiedPageRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(Math.max(1, Number(initialPage) || 1));
  const [zoom, setZoom] = useState(1.15);

  useEffect(() => {
    setCurrentPage(Math.max(1, Number(initialPage) || 1));
  }, [initialPage, src]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setPageCount(0);

    if (!src) {
      setLoading(false);
      setError('No se encontro el archivo del libro.');
      return undefined;
    }

    const task = getDocument(src);
    task.promise
      .then((pdf) => {
        if (cancelled) return;
        pdfRef.current = pdf;
        setPageCount(pdf.numPages || 0);
        setCurrentPage((page) => Math.min(Math.max(1, page), pdf.numPages || 1));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'No se pudo abrir el PDF.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel?.();
      task.destroy?.();
      pdfRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      const pdf = pdfRef.current;
      const canvas = canvasRef.current;
      if (!pdf || !canvas || !pageCount) return;

      setLoading(true);
      setError('');

      try {
        renderTaskRef.current?.cancel?.();
        const page = await pdf.getPage(currentPage);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: zoom });
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderTask = page.render({ canvasContext: context, viewport });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        if (cancelled) return;

        setLoading(false);
        if (lastNotifiedPageRef.current !== currentPage) {
          lastNotifiedPageRef.current = currentPage;
          onPageChange?.(currentPage);
        }
      } catch (err) {
        if (cancelled || err?.name === 'RenderingCancelledException') return;
        setError(err?.message || 'No se pudo renderizar la pagina.');
        setLoading(false);
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel?.();
    };
  }, [currentPage, zoom, pageCount, onPageChange]);

  const previousDisabled = currentPage <= 1;
  const nextDisabled = pageCount > 0 ? currentPage >= pageCount : true;

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/95 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-100">{title}</div>
          <div className="mt-1 text-xs text-slate-400">
            {pageCount > 0 ? `Pagina ${currentPage} de ${pageCount}` : 'Cargando documento'}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(0.7, Number((value - 0.1).toFixed(2))))}
            className="inline-flex items-center justify-center rounded border border-slate-700 px-2.5 py-2 text-slate-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-200"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="min-w-[58px] text-center text-xs font-semibold text-slate-300">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(2.5, Number((value + 0.1).toFixed(2))))}
            className="inline-flex items-center justify-center rounded border border-slate-700 px-2.5 py-2 text-slate-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-200"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={previousDisabled}
            className="inline-flex items-center justify-center rounded border border-slate-700 px-2.5 py-2 text-slate-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(pageCount || page, page + 1))}
            disabled={nextDisabled}
            className="inline-flex items-center justify-center rounded border border-slate-700 px-2.5 py-2 text-slate-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto bg-slate-950 p-4">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/70 text-sm text-slate-400">
            Cargando pagina...
          </div>
        )}

        {error ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            {error}
          </div>
        ) : (
          <div className="flex justify-center">
            <canvas ref={canvasRef} className="max-w-full rounded-lg bg-white shadow-2xl" />
          </div>
        )}
      </div>
    </div>
  );
}
