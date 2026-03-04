// ─── CultureSongField ───────────────────────────────────────────────────────
// List of up to 3 song entries: title + optional share link (Spotify, YouTube, etc.).
// value = [{ title, url }, ...]; legacy: string items are normalized to { title, url: '' }.

export default function CultureSongField({ label, value = [], onChange, titlePlaceholder = '', urlPlaceholder = '', addLabel = '+ Add', maxItems = 3 }) {
  const normalize = (item) => {
    if (item == null) return { title: '', url: '' };
    if (typeof item === 'string') return { title: item, url: '' };
    return { title: item.title ?? item.text ?? '', url: item.url ?? '' };
  };
  const items = (Array.isArray(value) ? value : []).map(normalize);
  const set = (i, field, val) => {
    const next = items.map((it, j) => (j === i ? { ...it, [field]: val } : it));
    onChange(next);
  };
  const add = () => {
    if (items.length >= maxItems) return;
    onChange([...items, { title: '', url: '' }]);
  };
  const remove = (i) => {
    onChange(items.filter((_, j) => j !== i));
  };
  return (
    <div>
      <label className="text-[11px] text-slate-500 block mb-1">{label}</label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex gap-1">
              <input
                value={item.title}
                onChange={(e) => set(i, 'title', e.target.value)}
                placeholder={titlePlaceholder}
                className="flex-1 min-w-0 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs"
              />
              <button type="button" onClick={() => remove(i)}
                className="shrink-0 text-slate-400 hover:text-red-400 px-2 text-sm transition-colors" title="Quitar">
                ×
              </button>
            </div>
            <input
              value={item.url}
              onChange={(e) => set(i, 'url', e.target.value)}
              placeholder={urlPlaceholder}
              type="url"
              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-300 placeholder-slate-500"
            />
          </div>
        ))}
        {items.length < maxItems && (
          <button type="button" onClick={add}
            className="text-[11px] text-emerald-400 hover:text-emerald-300">
            {addLabel}
          </button>
        )}
      </div>
    </div>
  );
}
