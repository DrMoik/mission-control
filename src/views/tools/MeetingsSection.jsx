import React, { useState } from 'react';
import { X } from 'lucide-react';
import { t, lang } from '../../strings.js';
import { ensureString } from '../../utils.js';

const createActionItem = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  text: '',
  assignee: '',
  deadline: '',
  done: false,
});

const emptyForm = () => ({
  organization: '',
  date: '',
  agenda: '',
  discussion: '',
  decisions: '',
  teamMembersText: '',
  nextMeetingDate: '',
  categoryId: '',
  actionItems: [createActionItem()],
});

const normalizeMembers = (value) => {
  if (Array.isArray(value)) return value.map((item) => ensureString(item, lang).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const membersToText = (meeting) => {
  const members = normalizeMembers(meeting.teamMembers);
  if (members.length > 0) return members.join('\n');
  return ensureString(meeting.attendees, lang);
};

const normalizeActionItems = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return [createActionItem()];

  return items.map((item, index) => ({
    id: item?.id || `${Date.now()}-${index}`,
    text: ensureString(item?.text, lang),
    assignee: ensureString(item?.assignee, lang),
    deadline: typeof item?.deadline === 'string' ? item.deadline : '',
    done: Boolean(item?.done),
  }));
};

const sanitizeActionItems = (items = []) =>
  items
    .map((item) => ({
      id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: (item.text || '').trim(),
      assignee: (item.assignee || '').trim(),
      deadline: item.deadline || '',
      done: Boolean(item.done),
    }))
    .filter((item) => item.text || item.assignee || item.deadline);

const startDraftFromMeeting = (meeting) => ({
  organization: ensureString(meeting.organization || meeting.title, lang),
  date: meeting.date || '',
  agenda: ensureString(meeting.agenda, lang),
  discussion: ensureString(meeting.discussion || meeting.notes, lang),
  decisions: ensureString(meeting.decisions, lang),
  teamMembersText: membersToText(meeting),
  nextMeetingDate: meeting.nextMeetingDate || '',
  categoryId: meeting.categoryId || '',
  actionItems: normalizeActionItems(meeting.actionItems),
});

const formatDateLabel = (value) => {
  if (!value) return t('tbd_label');
  return new Date(`${value}T12:00:00`).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const Section = ({ title, children }) => (
  <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</div>
    {children}
  </div>
);

const FieldLabel = ({ children }) => (
  <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">{children}</label>
);

const inputClass =
  'w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500';
const textareaClass = `${inputClass} min-h-[92px]`;

function ActionItemsEditor({ items, onChange }) {
  const updateItem = (id, field, value) => {
    onChange(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const addItem = () => onChange([...items, createActionItem()]);
  const removeItem = (id) => onChange(items.filter((item) => item.id !== id));

  return (
    <div className="space-y-2">
      <div className="hidden rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 md:grid md:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_140px_44px] md:gap-2">
        <div>Punto de accion</div>
        <div>Responsable</div>
        <div>Fecha limite</div>
        <div />
      </div>
      {items.map((item) => (
        <div key={item.id} className="grid gap-2 rounded-lg border border-slate-700 bg-slate-900/40 p-2 md:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_140px_44px]">
          <input
            value={item.text}
            onChange={(e) => updateItem(item.id, 'text', e.target.value)}
            placeholder="Accion a realizar"
            className={inputClass}
          />
          <input
            value={item.assignee}
            onChange={(e) => updateItem(item.id, 'assignee', e.target.value)}
            placeholder="Persona responsable"
            className={inputClass}
          />
          <input
            type="date"
            value={item.deadline}
            onChange={(e) => updateItem(item.id, 'deadline', e.target.value)}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => removeItem(item.id)}
            className="inline-flex h-10 items-center justify-center rounded border border-slate-700 text-red-400 transition-colors hover:border-red-500/60 hover:text-red-300"
            title={t('delete')}
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="rounded border border-dashed border-emerald-600/60 px-3 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:border-emerald-400 hover:text-emerald-200"
      >
        + Agregar punto de accion
      </button>
    </div>
  );
}

function ActionItemsTable({ meeting, canEditThis, onToggleAction, onRemoveAction }) {
  const items = Array.isArray(meeting.actionItems) ? meeting.actionItems : [];

  if (items.length === 0) {
    return <p className="text-sm text-slate-500">Sin puntos de accion registrados.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700">
      <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_130px_60px] bg-slate-900/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        <div>Punto de accion</div>
        <div>Responsable</div>
        <div>Fecha limite</div>
        <div className="text-center">Estado</div>
      </div>
      {items.map((item) => (
        <div key={item.id} className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_130px_60px] items-center gap-2 border-t border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-slate-200">
          <div className={item.done ? 'line-through text-slate-500' : ''}>{ensureString(item.text, lang) || '-'}</div>
          <div className="text-slate-300">{ensureString(item.assignee, lang) || '-'}</div>
          <div className="text-slate-300">{item.deadline ? formatDateLabel(item.deadline) : '-'}</div>
          <div className="flex items-center justify-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(item.done)}
              onChange={() => onToggleAction(meeting, item.id)}
              className="accent-emerald-500"
            />
            {canEditThis && (
              <button
                type="button"
                onClick={() => onRemoveAction(meeting, item.id)}
                className="text-red-400 transition-colors hover:text-red-300"
                title={t('delete')}
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MeetingsSection({
  meetings, categories, canCreate, resolveCanEdit,
  onCreateMeeting, onUpdateMeeting, onDeleteMeeting,
}) {
  const [form, setForm] = useState(emptyForm());
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    const organization = form.organization.trim();
    if (!organization) return;

    const teamMembers = normalizeMembers(form.teamMembersText);
    const actionItems = sanitizeActionItems(form.actionItems);
    const agenda = form.agenda.trim();
    const discussion = form.discussion.trim();
    const decisions = form.decisions.trim();

    await onCreateMeeting({
      title: organization,
      organization,
      date: form.date,
      agenda,
      discussion,
      decisions,
      attendees: teamMembers.join(', '),
      teamMembers,
      nextMeetingDate: form.nextMeetingDate || '',
      categoryId: form.categoryId || null,
      notes: discussion || agenda,
      actionItems,
    });

    setForm(emptyForm());
  };

  const toggleAction = async (meeting, itemId) => {
    const updated = (meeting.actionItems || []).map((item) => (
      item.id === itemId ? { ...item, done: !item.done } : item
    ));
    await onUpdateMeeting(meeting.id, { actionItems: updated });
  };

  const removeAction = async (meeting, itemId) => {
    const updated = (meeting.actionItems || []).filter((item) => item.id !== itemId);
    await onUpdateMeeting(meeting.id, { actionItems: updated });
  };

  const startEdit = (meeting) => {
    setEditingId(meeting.id);
    setEditDraft(startDraftFromMeeting(meeting));
  };

  const saveEdit = async (meeting) => {
    if (!editDraft) return;

    const organization = editDraft.organization.trim();
    if (!organization) return;

    const teamMembers = normalizeMembers(editDraft.teamMembersText);
    const agenda = editDraft.agenda.trim();
    const discussion = editDraft.discussion.trim();

    await onUpdateMeeting(meeting.id, {
      title: organization,
      organization,
      date: editDraft.date,
      agenda,
      discussion,
      decisions: editDraft.decisions.trim(),
      attendees: teamMembers.join(', '),
      teamMembers,
      nextMeetingDate: editDraft.nextMeetingDate || '',
      notes: discussion || agenda,
      categoryId: editDraft.categoryId || null,
      actionItems: sanitizeActionItems(editDraft.actionItems),
    });

    setEditingId(null);
    setEditDraft(null);
  };

  return (
    <div className="space-y-4">
      {canCreate && (
        <form onSubmit={handleCreate} className="space-y-4 rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="border-b border-slate-700 pb-3 text-center">
            <div className="text-lg font-semibold text-slate-100">Registro de Minutas del Equipo</div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_180px]">
            <div>
              <FieldLabel>Organizacion / equipo</FieldLabel>
              <input
                value={form.organization}
                onChange={(e) => setForm((current) => ({ ...current, organization: e.target.value }))}
                placeholder="Nombre del equipo u organizacion"
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <FieldLabel>Fecha</FieldLabel>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))}
                className={`${inputClass} mt-1`}
              />
            </div>
          </div>

          <Section title="Agenda">
            <textarea
              value={form.agenda}
              onChange={(e) => setForm((current) => ({ ...current, agenda: e.target.value }))}
              placeholder={'1. Tema principal\n2. Seguimiento\n3. Riesgos o bloqueos'}
              className={textareaClass}
            />
          </Section>

          <Section title="Discusion">
            <textarea
              value={form.discussion}
              onChange={(e) => setForm((current) => ({ ...current, discussion: e.target.value }))}
              placeholder="Resumen de la conversacion y puntos tratados"
              className={textareaClass}
            />
          </Section>

          <Section title="Decisiones tomadas">
            <textarea
              value={form.decisions}
              onChange={(e) => setForm((current) => ({ ...current, decisions: e.target.value }))}
              placeholder="Decisiones acordadas durante la reunion"
              className={textareaClass}
            />
          </Section>

          <Section title="Puntos de accion">
            <ActionItemsEditor
              items={form.actionItems}
              onChange={(actionItems) => setForm((current) => ({ ...current, actionItems }))}
            />
          </Section>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_180px]">
            <div>
              <FieldLabel>Integrantes del equipo</FieldLabel>
              <textarea
                value={form.teamMembersText}
                onChange={(e) => setForm((current) => ({ ...current, teamMembersText: e.target.value }))}
                placeholder={'Un integrante por linea\nTambien puedes separar por comas'}
                className={`${textareaClass} mt-1 min-h-[110px]`}
              />
            </div>
            <div className="space-y-3">
              <div>
                <FieldLabel>Next meeting date</FieldLabel>
                <input
                  type="date"
                  value={form.nextMeetingDate}
                  onChange={(e) => setForm((current) => ({ ...current, nextMeetingDate: e.target.value }))}
                  className={`${inputClass} mt-1`}
                />
              </div>
              <div>
                <FieldLabel>{t('scope_label')}</FieldLabel>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm((current) => ({ ...current, categoryId: e.target.value }))}
                  className={`${inputClass} mt-1 text-sm`}
                >
                  <option value="">{t('scope_global')}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {t('scope_category')} {ensureString(category.name, lang)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-black">
              Guardar minuta
            </button>
          </div>
        </form>
      )}

      {meetings.length === 0 && (
        <div className="rounded-lg bg-slate-800 p-8 text-center text-xs text-slate-500">{t('no_meetings_add')}</div>
      )}

      {[...meetings].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((meeting) => {
        const isExpanded = expandedId === meeting.id;
        const isEditing = editingId === meeting.id;
        const canEditThis = resolveCanEdit(meeting);
        const done = (meeting.actionItems || []).filter((item) => item.done).length;
        const total = (meeting.actionItems || []).length;
        const title = ensureString(meeting.organization || meeting.title, lang) || 'Minuta sin titulo';
        const members = normalizeMembers(meeting.teamMembers);
        const attendeeSummary = members.length > 0
          ? `${members.length} integrantes`
          : ensureString(meeting.attendees, lang);

        return (
          <div key={meeting.id} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
            <div
              className="flex cursor-pointer items-start gap-3 px-4 py-3"
              onClick={() => setExpandedId(isExpanded ? null : meeting.id)}
            >
              <div className="w-16 shrink-0 rounded-lg bg-slate-700 p-2 text-center">
                {meeting.date ? (
                  <>
                    <div className="text-[10px] uppercase text-slate-400">
                      {new Date(`${meeting.date}T12:00:00`).toLocaleString('default', { month: 'short' })}
                    </div>
                    <div className="text-xl font-bold leading-none">
                      {new Date(`${meeting.date}T12:00:00`).getDate()}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-500">{t('tbd_label')}</div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-100">{title}</div>
                {attendeeSummary && <div className="mt-0.5 text-xs text-slate-400">{attendeeSummary}</div>}
                {total > 0 && (
                  <div className="mt-0.5 text-xs text-slate-500">{`${done}/${total} puntos de accion completados`}</div>
                )}
                {meeting.nextMeetingDate && (
                  <div className="mt-1 text-[11px] text-emerald-300">
                    Proxima reunion: {formatDateLabel(meeting.nextMeetingDate)}
                  </div>
                )}
                <div className="mt-2">
                  {meeting.categoryId ? (
                    <span className="rounded-full bg-blue-900/40 px-1.5 py-0.5 text-[9px] text-blue-300">
                      {t('scope_category')} {ensureString(categories.find((category) => category.id === meeting.categoryId)?.name, lang) || meeting.categoryId}
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[9px] text-slate-500">{t('scope_global')}</span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {canEditThis && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); startEdit(meeting); }}
                      className="text-[11px] text-amber-400 underline"
                    >
                      {t('edit')}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDeleteMeeting(meeting.id); }}
                      className="text-[11px] text-red-400 underline"
                    >
                      {t('delete')}
                    </button>
                  </>
                )}
                <span className="text-slate-400">{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {isExpanded && !isEditing && (
              <div className="space-y-3 border-t border-slate-700 px-4 py-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Section title="Organizacion del equipo">
                    <p className="whitespace-pre-wrap text-sm text-slate-200">{title}</p>
                  </Section>
                  <Section title="Fecha">
                    <p className="text-sm text-slate-200">{formatDateLabel(meeting.date)}</p>
                  </Section>
                </div>

                <Section title="Agenda">
                  <p className="whitespace-pre-wrap text-sm text-slate-300">
                    {ensureString(meeting.agenda, lang) || 'Sin agenda registrada.'}
                  </p>
                </Section>

                <Section title="Discusion">
                  <p className="whitespace-pre-wrap text-sm text-slate-300">
                    {ensureString(meeting.discussion || meeting.notes, lang) || 'Sin notas registradas.'}
                  </p>
                </Section>

                <Section title="Decisiones tomadas">
                  <p className="whitespace-pre-wrap text-sm text-slate-300">
                    {ensureString(meeting.decisions, lang) || 'Sin decisiones registradas.'}
                  </p>
                </Section>

                <Section title="Puntos de accion">
                  <ActionItemsTable
                    meeting={meeting}
                    canEditThis={canEditThis}
                    onToggleAction={toggleAction}
                    onRemoveAction={removeAction}
                  />
                </Section>

                <div className="grid gap-3 md:grid-cols-2">
                  <Section title="Integrantes del equipo">
                    {members.length > 0 ? (
                      <div className="space-y-1 text-sm text-slate-300">
                        {members.map((member, index) => (
                          <div key={`${meeting.id}-member-${index}`}>{member}</div>
                        ))}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm text-slate-300">
                        {ensureString(meeting.attendees, lang) || 'Sin integrantes registrados.'}
                      </p>
                    )}
                  </Section>
                  <Section title="Fecha de la siguiente reunion">
                    <p className="text-sm text-slate-300">
                      {meeting.nextMeetingDate ? formatDateLabel(meeting.nextMeetingDate) : 'Por definir'}
                    </p>
                  </Section>
                </div>

                {meeting.lastEditedBy && (
                  <p className="text-right text-[10px] text-slate-600">
                    {`Ultima edicion por ${meeting.lastEditedBy} el ${meeting.lastEditedAt?.toDate?.().toLocaleDateString() ?? ''}`}
                  </p>
                )}
              </div>
            )}

            {isEditing && editDraft && (
              <div className="space-y-4 border-t border-slate-700 px-4 py-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_180px]">
                  <div>
                    <FieldLabel>Organizacion / equipo</FieldLabel>
                    <input
                      value={editDraft.organization}
                      onChange={(e) => setEditDraft((current) => ({ ...current, organization: e.target.value }))}
                      className={`${inputClass} mt-1`}
                    />
                  </div>
                  <div>
                    <FieldLabel>Fecha</FieldLabel>
                    <input
                      type="date"
                      value={editDraft.date}
                      onChange={(e) => setEditDraft((current) => ({ ...current, date: e.target.value }))}
                      className={`${inputClass} mt-1`}
                    />
                  </div>
                </div>

                <Section title="Agenda">
                  <textarea
                    value={editDraft.agenda}
                    onChange={(e) => setEditDraft((current) => ({ ...current, agenda: e.target.value }))}
                    className={textareaClass}
                  />
                </Section>

                <Section title="Discusion">
                  <textarea
                    value={editDraft.discussion}
                    onChange={(e) => setEditDraft((current) => ({ ...current, discussion: e.target.value }))}
                    className={textareaClass}
                  />
                </Section>

                <Section title="Decisiones tomadas">
                  <textarea
                    value={editDraft.decisions}
                    onChange={(e) => setEditDraft((current) => ({ ...current, decisions: e.target.value }))}
                    className={textareaClass}
                  />
                </Section>

                <Section title="Puntos de accion">
                  <ActionItemsEditor
                    items={editDraft.actionItems}
                    onChange={(actionItems) => setEditDraft((current) => ({ ...current, actionItems }))}
                  />
                </Section>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_180px]">
                  <div>
                    <FieldLabel>Integrantes del equipo</FieldLabel>
                    <textarea
                      value={editDraft.teamMembersText}
                      onChange={(e) => setEditDraft((current) => ({ ...current, teamMembersText: e.target.value }))}
                      className={`${textareaClass} mt-1 min-h-[110px]`}
                    />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <FieldLabel>Fecha de la siguiente reunion</FieldLabel>
                      <input
                        type="date"
                        value={editDraft.nextMeetingDate}
                        onChange={(e) => setEditDraft((current) => ({ ...current, nextMeetingDate: e.target.value }))}
                        className={`${inputClass} mt-1`}
                      />
                    </div>
                    <div>
                      <FieldLabel>{t('scope_label')}</FieldLabel>
                      <select
                        value={editDraft.categoryId}
                        onChange={(e) => setEditDraft((current) => ({ ...current, categoryId: e.target.value }))}
                        className={`${inputClass} mt-1 text-sm`}
                      >
                        <option value="">{t('scope_global')}</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {t('scope_category')} {ensureString(category.name, lang)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setEditingId(null); setEditDraft(null); }} className="text-xs text-slate-400 underline">
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => saveEdit(meeting)}
                    className="rounded bg-emerald-500 px-3 py-1 text-xs font-semibold text-black"
                  >
                    {t('save')}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
