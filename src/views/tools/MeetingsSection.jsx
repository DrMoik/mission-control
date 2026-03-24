import React, { useState } from 'react';
import { X, ChevronDown, Plus } from 'lucide-react';
import { t, lang } from '../../strings.js';
import PickerField from '../../components/ui/PickerField.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Textarea from '../../components/ui/Textarea.jsx';
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

const sectionPanelCls = 'rounded-lg border border-slate-700/40 bg-surface-sunken/40 p-3';
const sectionLabelCls = 'mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-content-tertiary';
const pickerCls = 'w-full rounded-lg border border-slate-600 bg-surface-sunken px-3 py-2 text-sm text-content-primary placeholder:text-content-tertiary focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors duration-150';
const selectCls = 'w-full rounded-lg border border-slate-600 bg-surface-sunken px-3 py-2 text-sm text-content-secondary focus:border-primary focus:outline-none';

function SectionPanel({ title, children }) {
  return (
    <div className={sectionPanelCls}>
      <div className={sectionLabelCls}>{title}</div>
      {children}
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-content-tertiary">{children}</label>
  );
}

function ActionItemsEditor({ items, onChange }) {
  const updateItem = (id, field, value) => {
    onChange(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };
  const addItem = () => onChange([...items, createActionItem()]);
  const removeItem = (id) => onChange(items.filter((item) => item.id !== id));

  return (
    <div className="space-y-2">
      <div className="hidden rounded-lg border border-slate-700/40 bg-surface-sunken/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-content-tertiary md:grid md:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_140px_44px] md:gap-2">
        <div>Punto de accion</div>
        <div>Responsable</div>
        <div>Fecha limite</div>
        <div />
      </div>
      {items.map((item) => (
        <div key={item.id} className="grid gap-2 rounded-lg border border-slate-700/40 bg-surface-sunken/30 p-2 md:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_140px_44px]">
          <Input value={item.text} onChange={(e) => updateItem(item.id, 'text', e.target.value)} placeholder="Accion a realizar" />
          <Input value={item.assignee} onChange={(e) => updateItem(item.id, 'assignee', e.target.value)} placeholder="Persona responsable" />
          <PickerField type="date" value={item.deadline} onChange={(value) => updateItem(item.id, 'deadline', value)} placeholder="Seleccionar fecha" className={pickerCls} />
          <button
            type="button"
            onClick={() => removeItem(item.id)}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-700/40 text-red-400 transition-colors hover:border-red-500/60 hover:text-red-300"
            title={t('delete')}
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="rounded-lg border border-dashed border-primary/40 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:border-primary/70"
      >
        + Agregar punto de accion
      </button>
    </div>
  );
}

function ActionItemsTable({ meeting, canEditThis, onToggleAction, onRemoveAction }) {
  const items = Array.isArray(meeting.actionItems) ? meeting.actionItems : [];
  if (items.length === 0) {
    return <p className="text-sm text-content-tertiary">Sin puntos de accion registrados.</p>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-slate-700/40">
      <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_130px_60px] bg-surface-sunken/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-content-tertiary">
        <div>Punto de accion</div>
        <div>Responsable</div>
        <div>Fecha limite</div>
        <div className="text-center">Estado</div>
      </div>
      {items.map((item) => (
        <div key={item.id} className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_130px_60px] items-center gap-2 border-t border-slate-700/40 bg-surface-sunken/20 px-3 py-2 text-sm text-content-primary">
          <div className={item.done ? 'line-through text-content-tertiary' : ''}>{ensureString(item.text, lang) || '-'}</div>
          <div className="text-content-secondary">{ensureString(item.assignee, lang) || '-'}</div>
          <div className="text-content-secondary">{item.deadline ? formatDateLabel(item.deadline) : '-'}</div>
          <div className="flex items-center justify-center gap-2">
            <input type="checkbox" checked={Boolean(item.done)} onChange={() => onToggleAction(meeting, item.id)} className="accent-primary" />
            {canEditThis && (
              <button type="button" onClick={() => onRemoveAction(meeting, item.id)} className="text-red-400 transition-colors hover:text-red-300" title={t('delete')}>
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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    const organization = form.organization.trim();
    if (!organization) return;
    const teamMembers = normalizeMembers(form.teamMembersText);
    const actionItems = sanitizeActionItems(form.actionItems);
    await onCreateMeeting({
      title: organization,
      organization,
      date: form.date,
      agenda: form.agenda.trim(),
      discussion: form.discussion.trim(),
      decisions: form.decisions.trim(),
      attendees: teamMembers.join(', '),
      teamMembers,
      nextMeetingDate: form.nextMeetingDate || '',
      categoryId: form.categoryId || null,
      notes: form.discussion.trim() || form.agenda.trim(),
      actionItems,
    });
    setForm(emptyForm());
    setShowCreateForm(false);
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
    const discussion = editDraft.discussion.trim();
    await onUpdateMeeting(meeting.id, {
      title: organization,
      organization,
      date: editDraft.date,
      agenda: editDraft.agenda.trim(),
      discussion,
      decisions: editDraft.decisions.trim(),
      attendees: teamMembers.join(', '),
      teamMembers,
      nextMeetingDate: editDraft.nextMeetingDate || '',
      notes: discussion || editDraft.agenda.trim(),
      categoryId: editDraft.categoryId || null,
      actionItems: sanitizeActionItems(editDraft.actionItems),
    });
    setEditingId(null);
    setEditDraft(null);
  };

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-content-primary tracking-tight">{t('meetings_title')}</h2>
          <p className="text-sm text-content-secondary mt-0.5">{t('tool_desc_meetings')}</p>
        </div>
        {canCreate && !showCreateForm && (
          <div className="shrink-0">
            <Button size="sm" onClick={() => setShowCreateForm(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2.5} />{t('new_meeting_btn')}
            </Button>
          </div>
        )}
      </div>

      {/* ── Create form panel ── */}
      {canCreate && showCreateForm && (
        <form onSubmit={handleCreate} className="space-y-4 rounded-xl border border-slate-700/40 bg-surface-raised shadow-surface-sm p-5">
          <div className="border-b border-slate-700/40 pb-3">
            <div className="text-base font-semibold text-content-primary">Registro de Minutas del Equipo</div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_180px]">
            <div>
              <FieldLabel>Organizacion / equipo</FieldLabel>
              <Input value={form.organization}
                onChange={(e) => setForm((c) => ({ ...c, organization: e.target.value }))}
                placeholder="Nombre del equipo u organizacion" className="mt-1" />
            </div>
            <div>
              <FieldLabel>Fecha</FieldLabel>
              <PickerField type="date" value={form.date}
                onChange={(value) => setForm((c) => ({ ...c, date: value }))}
                placeholder="Seleccionar fecha" className={`${pickerCls} mt-1`} />
            </div>
          </div>

          <SectionPanel title="Agenda">
            <Textarea value={form.agenda}
              onChange={(e) => setForm((c) => ({ ...c, agenda: e.target.value }))}
              placeholder={'1. Tema principal\n2. Seguimiento\n3. Riesgos o bloqueos'} />
          </SectionPanel>

          <SectionPanel title="Discusion">
            <Textarea value={form.discussion}
              onChange={(e) => setForm((c) => ({ ...c, discussion: e.target.value }))}
              placeholder="Resumen de la conversacion y puntos tratados" />
          </SectionPanel>

          <SectionPanel title="Decisiones tomadas">
            <Textarea value={form.decisions}
              onChange={(e) => setForm((c) => ({ ...c, decisions: e.target.value }))}
              placeholder="Decisiones acordadas durante la reunion" />
          </SectionPanel>

          <SectionPanel title="Puntos de accion">
            <ActionItemsEditor items={form.actionItems}
              onChange={(actionItems) => setForm((c) => ({ ...c, actionItems }))} />
          </SectionPanel>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_180px]">
            <div>
              <FieldLabel>Integrantes del equipo</FieldLabel>
              <Textarea value={form.teamMembersText}
                onChange={(e) => setForm((c) => ({ ...c, teamMembersText: e.target.value }))}
                placeholder={'Un integrante por linea\nTambien puedes separar por comas'}
                className="mt-1 min-h-[110px]" />
            </div>
            <div className="space-y-3">
              <div>
                <FieldLabel>Fecha de la siguiente reunion</FieldLabel>
                <PickerField type="date" value={form.nextMeetingDate}
                  onChange={(value) => setForm((c) => ({ ...c, nextMeetingDate: value }))}
                  placeholder="Seleccionar fecha" className={`${pickerCls} mt-1`} />
              </div>
              <div>
                <FieldLabel>{t('scope_label')}</FieldLabel>
                <select value={form.categoryId}
                  onChange={(e) => setForm((c) => ({ ...c, categoryId: e.target.value }))}
                  className={`${selectCls} mt-1`}>
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

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/40">
            <Button type="button" variant="secondary" size="sm" onClick={() => { setShowCreateForm(false); setForm(emptyForm()); }}>{t('cancel')}</Button>
            <Button type="submit" size="sm">Guardar minuta</Button>
          </div>
        </form>
      )}

      {/* ── Meetings panel ── */}
      <div className="rounded-xl border border-slate-700/40 bg-surface-raised shadow-surface-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-content-tertiary">{t('meetings_title')}</span>
          <span className="text-xs text-content-tertiary">{meetings.length} minutas</span>
        </div>

        {meetings.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="text-content-tertiary text-sm">{t('no_meetings_add')}</div>
            {canCreate && !showCreateForm && (
              <Button size="sm" className="mt-4" onClick={() => setShowCreateForm(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={2.5} />{t('new_meeting_btn')}
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-700/40">
            {[...meetings].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((meeting, meetingIndex) => {
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
                <div key={meeting.id} className="animate-slide-up" style={{ animationDelay: `${Math.min(meetingIndex * 50, 300)}ms` }}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-700/20 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : meeting.id)}
                  >
                    <div className="w-14 shrink-0 rounded-lg bg-surface-overlay border border-slate-700/40 p-2 text-center">
                      {meeting.date ? (
                        <>
                          <div className="text-[10px] uppercase text-content-tertiary">
                            {new Date(`${meeting.date}T12:00:00`).toLocaleString('default', { month: 'short' })}
                          </div>
                          <div className="text-xl font-bold leading-none text-content-primary">
                            {new Date(`${meeting.date}T12:00:00`).getDate()}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-content-tertiary">{t('tbd_label')}</div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-content-primary">{title}</div>
                      {attendeeSummary && <div className="mt-0.5 text-xs text-content-tertiary">{attendeeSummary}</div>}
                      {total > 0 && (
                        <div className="mt-0.5 text-xs text-content-tertiary">{`${done}/${total} puntos de accion completados`}</div>
                      )}
                      {meeting.nextMeetingDate && (
                        <div className="mt-1 text-[11px] text-primary">
                          Proxima reunion: {formatDateLabel(meeting.nextMeetingDate)}
                        </div>
                      )}
                      <div className="mt-1.5">
                        {meeting.categoryId ? (
                          <span className="rounded-full bg-blue-900/40 px-1.5 py-0.5 text-[9px] text-blue-300">
                            {t('scope_category')} {ensureString(categories.find((c) => c.id === meeting.categoryId)?.name, lang) || meeting.categoryId}
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-700/60 px-1.5 py-0.5 text-[9px] text-content-tertiary">{t('scope_global')}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {canEditThis && (
                        <>
                          <button type="button" onClick={(e) => { e.stopPropagation(); startEdit(meeting); }} className="text-[11px] text-amber-400 hover:underline">{t('edit')}</button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); onDeleteMeeting(meeting.id); }} className="text-[11px] text-red-400 hover:underline">{t('delete')}</button>
                        </>
                      )}
                      <ChevronDown className={`h-4 w-4 text-content-tertiary transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Expanded detail view */}
                  {isExpanded && !isEditing && (
                    <div className="space-y-3 border-t border-slate-700/40 bg-surface-sunken/30 px-4 py-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <SectionPanel title="Organizacion del equipo">
                          <p className="whitespace-pre-wrap text-sm text-content-primary">{title}</p>
                        </SectionPanel>
                        <SectionPanel title="Fecha">
                          <p className="text-sm text-content-primary">{formatDateLabel(meeting.date)}</p>
                        </SectionPanel>
                      </div>
                      <SectionPanel title="Agenda">
                        <p className="whitespace-pre-wrap text-sm text-content-secondary">{ensureString(meeting.agenda, lang) || 'Sin agenda registrada.'}</p>
                      </SectionPanel>
                      <SectionPanel title="Discusion">
                        <p className="whitespace-pre-wrap text-sm text-content-secondary">{ensureString(meeting.discussion || meeting.notes, lang) || 'Sin notas registradas.'}</p>
                      </SectionPanel>
                      <SectionPanel title="Decisiones tomadas">
                        <p className="whitespace-pre-wrap text-sm text-content-secondary">{ensureString(meeting.decisions, lang) || 'Sin decisiones registradas.'}</p>
                      </SectionPanel>
                      <SectionPanel title="Puntos de accion">
                        <ActionItemsTable meeting={meeting} canEditThis={canEditThis} onToggleAction={toggleAction} onRemoveAction={removeAction} />
                      </SectionPanel>
                      <div className="grid gap-3 md:grid-cols-2">
                        <SectionPanel title="Integrantes del equipo">
                          {members.length > 0 ? (
                            <div className="space-y-1 text-sm text-content-secondary">
                              {members.map((member, index) => <div key={`${meeting.id}-member-${index}`}>{member}</div>)}
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap text-sm text-content-secondary">{ensureString(meeting.attendees, lang) || 'Sin integrantes registrados.'}</p>
                          )}
                        </SectionPanel>
                        <SectionPanel title="Fecha de la siguiente reunion">
                          <p className="text-sm text-content-secondary">{meeting.nextMeetingDate ? formatDateLabel(meeting.nextMeetingDate) : 'Por definir'}</p>
                        </SectionPanel>
                      </div>
                      {meeting.lastEditedBy && (
                        <p className="text-right text-[10px] text-content-tertiary">
                          {`Ultima edicion por ${meeting.lastEditedBy} el ${meeting.lastEditedAt?.toDate?.().toLocaleDateString() ?? ''}`}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Edit form */}
                  {isEditing && editDraft && (
                    <div className="space-y-4 border-t border-slate-700/40 bg-surface-sunken/30 px-4 py-4">
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_180px]">
                        <div>
                          <FieldLabel>Organizacion / equipo</FieldLabel>
                          <Input value={editDraft.organization}
                            onChange={(e) => setEditDraft((c) => ({ ...c, organization: e.target.value }))}
                            className="mt-1" />
                        </div>
                        <div>
                          <FieldLabel>Fecha</FieldLabel>
                          <PickerField type="date" value={editDraft.date}
                            onChange={(value) => setEditDraft((c) => ({ ...c, date: value }))}
                            placeholder="Seleccionar fecha" className={`${pickerCls} mt-1`} />
                        </div>
                      </div>

                      <SectionPanel title="Agenda">
                        <Textarea value={editDraft.agenda}
                          onChange={(e) => setEditDraft((c) => ({ ...c, agenda: e.target.value }))} />
                      </SectionPanel>
                      <SectionPanel title="Discusion">
                        <Textarea value={editDraft.discussion}
                          onChange={(e) => setEditDraft((c) => ({ ...c, discussion: e.target.value }))} />
                      </SectionPanel>
                      <SectionPanel title="Decisiones tomadas">
                        <Textarea value={editDraft.decisions}
                          onChange={(e) => setEditDraft((c) => ({ ...c, decisions: e.target.value }))} />
                      </SectionPanel>
                      <SectionPanel title="Puntos de accion">
                        <ActionItemsEditor items={editDraft.actionItems}
                          onChange={(actionItems) => setEditDraft((c) => ({ ...c, actionItems }))} />
                      </SectionPanel>

                      <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_180px]">
                        <div>
                          <FieldLabel>Integrantes del equipo</FieldLabel>
                          <Textarea value={editDraft.teamMembersText}
                            onChange={(e) => setEditDraft((c) => ({ ...c, teamMembersText: e.target.value }))}
                            className="mt-1 min-h-[110px]" />
                        </div>
                        <div className="space-y-3">
                          <div>
                            <FieldLabel>Fecha de la siguiente reunion</FieldLabel>
                            <PickerField type="date" value={editDraft.nextMeetingDate}
                              onChange={(value) => setEditDraft((c) => ({ ...c, nextMeetingDate: value }))}
                              placeholder="Seleccionar fecha" className={`${pickerCls} mt-1`} />
                          </div>
                          <div>
                            <FieldLabel>{t('scope_label')}</FieldLabel>
                            <select value={editDraft.categoryId}
                              onChange={(e) => setEditDraft((c) => ({ ...c, categoryId: e.target.value }))}
                              className={`${selectCls} mt-1`}>
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

                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/40">
                        <Button type="button" variant="secondary" size="sm" onClick={() => { setEditingId(null); setEditDraft(null); }}>{t('cancel')}</Button>
                        <Button type="button" size="sm" onClick={() => saveEdit(meeting)}>{t('save')}</Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
