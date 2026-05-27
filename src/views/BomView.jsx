import React, { useMemo, useState } from 'react';

const DEFAULT_SUBSYSTEMS = ['Chasis', 'Tracción', 'Brazo', 'Laboratorio', 'Antenas'];

const MATERIAL_OPTIONS = [
  'Aluminio', 'Acero', 'PETG', 'TPU', 'Compuesto',
  'PLA', 'ABS', 'Fibra de Carbono', 'Cobre', 'Plástico',
];

const MANUFACTURING_OPTIONS = [
  'Láser', 'Maquinado', 'Impresión 3D', 'Manual', 'Compras', 'Fundición', 'Soldadura',
];

const VERSION_OPTIONS = ['Rev A', 'Rev B', 'Rev C', 'Rev D', 'Rev E', 'v1.0', 'v1.1', 'v2.0'];

const EMPTY_DRAFT = {
  subsystem: '',
  name: '',
  quantity: '',
  version: '',
  material: '',
  manufacturing: '',
  notes: '',
};

function SelectInput({ value, onChange, options, placeholder = '—', className = '' }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-surface-raised border border-border rounded px-1.5 py-1 text-sm text-content-primary focus:outline-none focus:ring-1 focus:ring-primary ${className}`}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function TextInput({ value, onChange, type = 'text', placeholder = '', className = '' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-surface-raised border border-border rounded px-1.5 py-1 text-sm text-content-primary focus:outline-none focus:ring-1 focus:ring-primary ${className}`}
    />
  );
}

export default function BomView({
  parts = [],
  canManage = false,
  subsystems = DEFAULT_SUBSYSTEMS,
  onCreatePart,
  onUpdatePart,
  onDeletePart,
}) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingDraft, setEditingDraft] = useState(EMPTY_DRAFT);
  const [subsystemFilter, setSubsystemFilter] = useState('all');
  const [saving, setSaving] = useState(false);

  const filteredParts = useMemo(() => {
    if (subsystemFilter === 'all') return parts;
    return parts.filter((p) => p.subsystem === subsystemFilter);
  }, [parts, subsystemFilter]);

  const sortedParts = useMemo(() => {
    const order = {};
    subsystems.forEach((s, i) => { order[s] = i; });
    return [...filteredParts].sort((a, b) => {
      const oa = order[a.subsystem] ?? 999;
      const ob = order[b.subsystem] ?? 999;
      if (oa !== ob) return oa - ob;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }, [filteredParts, subsystems]);

  const handleCreate = async () => {
    if (!draft.subsystem || !draft.name.trim()) return;
    setSaving(true);
    try {
      await onCreatePart?.({
        subsystem: draft.subsystem,
        name: draft.name.trim(),
        quantity: Number(draft.quantity) || 0,
        version: draft.version,
        material: draft.material,
        manufacturing: draft.manufacturing,
        notes: draft.notes.trim(),
      });
      setDraft({ ...EMPTY_DRAFT, subsystem: draft.subsystem });
      setShowAddForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id) => {
    if (!editingDraft.subsystem || !editingDraft.name.trim()) return;
    setSaving(true);
    try {
      await onUpdatePart?.(id, {
        subsystem: editingDraft.subsystem,
        name: editingDraft.name.trim(),
        quantity: Number(editingDraft.quantity) || 0,
        version: editingDraft.version,
        material: editingDraft.material,
        manufacturing: editingDraft.manufacturing,
        notes: editingDraft.notes.trim(),
      });
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta pieza del BOM?')) return;
    await onDeletePart?.(id);
  };

  const startEdit = (part) => {
    setEditingId(part.id);
    setEditingDraft({
      subsystem: part.subsystem || '',
      name: part.name || '',
      quantity: String(part.quantity ?? ''),
      version: part.version || '',
      material: part.material || '',
      manufacturing: part.manufacturing || '',
      notes: part.notes || '',
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditingDraft(EMPTY_DRAFT); };

  const totalParts = parts.length;
  const totalQty = parts.reduce((s, p) => s + (Number(p.quantity) || 0), 0);

  let lastSubsystem = null;

  return (
    <div className="space-y-6 max-w-[1200px]">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gradient tracking-tight">Lista de Materiales</h2>
          <p className="text-sm text-content-secondary mt-1">
            Partes necesarias para construir cada subsistema del rover.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalParts > 0 && (
            <span className="text-xs text-content-tertiary">
              {totalParts} {totalParts === 1 ? 'pieza' : 'piezas'} · {totalQty} uds. totales
            </span>
          )}
          {canManage && (
            <button
              onClick={() => { setShowAddForm((v) => !v); setEditingId(null); }}
              className="btn btn-primary text-sm"
            >
              {showAddForm ? 'Cancelar' : '+ Agregar pieza'}
            </button>
          )}
        </div>
      </div>

      {/* Subsystem filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-content-tertiary font-medium uppercase tracking-wide">Subsistema:</span>
        {['all', ...subsystems].map((sub) => (
          <button
            key={sub}
            onClick={() => setSubsystemFilter(sub)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              subsystemFilter === sub
                ? 'border-primary text-primary bg-primary/10 font-semibold'
                : 'border-border text-content-tertiary hover:text-content-primary hover:border-content-tertiary'
            }`}
          >
            {sub === 'all' ? 'Todos' : sub}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showAddForm && canManage && (
        <div className="card p-4 space-y-4">
          <h3 className="text-sm font-semibold text-content-primary">Nueva Pieza</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-content-tertiary">Subsistema *</label>
              <SelectInput
                value={draft.subsystem}
                onChange={(v) => setDraft((d) => ({ ...d, subsystem: v }))}
                options={subsystems}
                placeholder="Seleccionar"
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-content-tertiary">Nombre *</label>
              <TextInput
                value={draft.name}
                onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
                placeholder="Nombre de la pieza"
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-content-tertiary">Cantidad</label>
              <TextInput
                type="number"
                value={draft.quantity}
                onChange={(v) => setDraft((d) => ({ ...d, quantity: v }))}
                placeholder="0"
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-content-tertiary">Versión</label>
              <SelectInput
                value={draft.version}
                onChange={(v) => setDraft((d) => ({ ...d, version: v }))}
                options={VERSION_OPTIONS}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-content-tertiary">Material</label>
              <SelectInput
                value={draft.material}
                onChange={(v) => setDraft((d) => ({ ...d, material: v }))}
                options={MATERIAL_OPTIONS}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-content-tertiary">Manufactura</label>
              <SelectInput
                value={draft.manufacturing}
                onChange={(v) => setDraft((d) => ({ ...d, manufacturing: v }))}
                options={MANUFACTURING_OPTIONS}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs text-content-tertiary">Notas</label>
              <TextInput
                value={draft.notes}
                onChange={(v) => setDraft((d) => ({ ...d, notes: v }))}
                placeholder="Notas opcionales"
                className="w-full"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !draft.subsystem || !draft.name.trim()}
              className="btn btn-primary text-sm disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar pieza'}
            </button>
            <button
              onClick={() => { setDraft(EMPTY_DRAFT); setShowAddForm(false); }}
              className="btn btn-ghost text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {parts.length === 0 && (
        <div className="card py-16 text-center">
          <p className="text-content-tertiary text-sm">No hay piezas registradas todavía.</p>
          {canManage && (
            <p className="text-content-tertiary text-xs mt-1">Usa el botón &quot;+ Agregar pieza&quot; para comenzar.</p>
          )}
        </div>
      )}

      {/* BOM Table */}
      {parts.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-primary text-white">
                <th className="px-3 py-2.5 text-left font-semibold">Subsistema</th>
                <th className="px-3 py-2.5 text-left font-semibold">Nombre</th>
                <th className="px-3 py-2.5 text-left font-semibold">Cantidad</th>
                <th className="px-3 py-2.5 text-left font-semibold">Versión</th>
                <th className="px-3 py-2.5 text-left font-semibold">Material</th>
                <th className="px-3 py-2.5 text-left font-semibold">Manufactura</th>
                <th className="px-3 py-2.5 text-left font-semibold">Notas</th>
                {canManage && <th className="px-3 py-2.5 text-left font-semibold">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {sortedParts.map((part, idx) => {
                const isNewSubsystem = part.subsystem !== lastSubsystem;
                lastSubsystem = part.subsystem;
                const isEditing = editingId === part.id;
                const rowBg = idx % 2 === 0 ? 'bg-surface' : 'bg-surface-raised';

                return (
                  <React.Fragment key={part.id}>
                    {isNewSubsystem && (
                      <tr>
                        <td
                          colSpan={canManage ? 8 : 7}
                          className="px-3 py-1.5 text-xs font-semibold text-content-secondary bg-surface-raised border-t border-b border-border uppercase tracking-wider"
                        >
                          {part.subsystem || 'Sin subsistema'}
                        </td>
                      </tr>
                    )}
                    {isEditing ? (
                      <tr className="bg-primary/5 border-b border-border">
                        <td className="px-2 py-1.5">
                          <SelectInput
                            value={editingDraft.subsystem}
                            onChange={(v) => setEditingDraft((d) => ({ ...d, subsystem: v }))}
                            options={subsystems}
                            className="w-full"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <TextInput
                            value={editingDraft.name}
                            onChange={(v) => setEditingDraft((d) => ({ ...d, name: v }))}
                            className="w-full"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <TextInput
                            type="number"
                            value={editingDraft.quantity}
                            onChange={(v) => setEditingDraft((d) => ({ ...d, quantity: v }))}
                            className="w-20"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <SelectInput
                            value={editingDraft.version}
                            onChange={(v) => setEditingDraft((d) => ({ ...d, version: v }))}
                            options={VERSION_OPTIONS}
                            className="w-full"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <SelectInput
                            value={editingDraft.material}
                            onChange={(v) => setEditingDraft((d) => ({ ...d, material: v }))}
                            options={MATERIAL_OPTIONS}
                            className="w-full"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <SelectInput
                            value={editingDraft.manufacturing}
                            onChange={(v) => setEditingDraft((d) => ({ ...d, manufacturing: v }))}
                            options={MANUFACTURING_OPTIONS}
                            className="w-full"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <TextInput
                            value={editingDraft.notes}
                            onChange={(v) => setEditingDraft((d) => ({ ...d, notes: v }))}
                            className="w-full"
                          />
                        </td>
                        {canManage && (
                          <td className="px-2 py-1.5">
                            <div className="flex gap-2 items-center">
                              <button
                                onClick={() => handleUpdate(part.id)}
                                disabled={saving}
                                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium disabled:opacity-50"
                              >
                                Guardar
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-xs text-content-tertiary hover:text-content-primary"
                              >
                                Cancelar
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ) : (
                      <tr className={`${rowBg} border-b border-border/50 hover:bg-primary/5 transition-colors`}>
                        <td className="px-3 py-2 text-content-secondary">{part.subsystem || '—'}</td>
                        <td className="px-3 py-2 font-medium text-content-primary">{part.name || '—'}</td>
                        <td className="px-3 py-2 tabular-nums">{part.quantity != null ? part.quantity : '—'}</td>
                        <td className="px-3 py-2 text-content-secondary">{part.version || '—'}</td>
                        <td className="px-3 py-2 text-content-secondary">{part.material || '—'}</td>
                        <td className="px-3 py-2 text-content-secondary">{part.manufacturing || '—'}</td>
                        <td className="px-3 py-2 text-content-tertiary">{part.notes || ''}</td>
                        {canManage && (
                          <td className="px-3 py-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => startEdit(part)}
                                className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDelete(part.id)}
                                className="text-xs text-red-400 hover:text-red-300 font-medium"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
