// ─── CultureListField ───────────────────────────────────────────────────────
// List of up to 3 text inputs. Used for culture section (e.g. songs, books, quotes).

export default function CultureListField({ label, value = [], onChange, placeholder = '', addLabel = '+ Add', maxItems = 3 }) {
  const items = Array.isArray(value) ? [...value] : [];
  const set = (i, val) => {
    const next = [...items];
    next[i] = val;
    onChange(next);
  };
  const add = () => {
    if (items.length >= maxItems) return;
    onChange([...items, '']);
  };
  const remove = (i) => {
    onChange(items.filter((_, j) => j !== i));
  };
  return (
    <div>
      <label className="text-[11px] text-slate-500 block mb-1">{label}</label>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-1">
            <input
              value={item}
              onChange={(e) => set(i, e.target.value)}
              placeholder={placeholder}
              className="flex-1 min-w-0 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs"
            />
            <button type="button" onClick={() => remove(i)}
              className="shrink-0 text-slate-400 hover:text-red-400 px-2 text-sm transition-colors" title="Quitar">
              ×
            </button>
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
