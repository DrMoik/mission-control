// ─── HowToUse ─────────────────────────────────────────────────────────────────
// Collapsible grey banner shown at the top of tool tabs.
// Takes descKey and looks up description from TOOL_DESCRIPTIONS (Spanish strings).

import React, { useState } from 'react';

const TOOL_DESCRIPTIONS = {
  tool_desc_calendar:
    'Registra eventos, competencias, fechas límite e hitos del equipo.\n\n• Global: visible para todos los miembros.\n• Por área: solo visible para esa categoría.\n• Cumpleaños: se añaden automáticamente cuando los miembros completan su fecha de nacimiento en el perfil.\n\nMarca la casilla para ver cumpleaños (global o por área).',
  tool_desc_swot:
    'Análisis FODA: mapea Fortalezas, Oportunidades, Debilidades y Amenazas del equipo para guiar sesiones de planeación estratégica.\n\nSiempre global. El resultado alimenta el plan con Eisenhower o Pugh.',
  tool_desc_kanban:
    'Visualiza el trabajo en columnas: Por Hacer → En Progreso → Hecho.\n\n• Añade tarjetas con el campo de texto.\n• Usa "Asignar" para crear tareas: escribe en la barra de búsqueda, filtra por área si eres admin, haz clic en el nombre.\n• Arrastra conceptualmente con "Mover a" entre columnas.',
  tool_desc_scrum:
    'Ejecuta Sprints ágiles: Product Backlog → Sprint Backlog → En Progreso → Hecho.\n\n• Cada tablero = un Sprint.\n• Asignar tarea: barra de búsqueda, escribe nombre, clic para asignar.\n• Los asignados ven la tarea en la pestaña Tareas y pueden solicitar revisión.',
  tool_desc_retro:
    'Retrospectiva tras cada Sprint.\n\n• Qué salió bien: celebra éxitos.\n• Qué mejorar: identifica problemas.\n• Acciones: tareas concretas para el siguiente ciclo.\n\nUsa el resultado para planear el siguiente Sprint.',
  tool_desc_availability:
    'Coordina horarios con una encuesta de disponibilidad estilo when2meet.\n\n• Define fechas y horas posibles.\n• Cada integrante marca en qué espacios puede asistir.\n• Cuando acuerden un horario final, la encuesta se elimina una semana después.',
  tool_desc_meetings:
    'Registra minutas con una estructura formal.\n\n• Captura organizacion, fecha, agenda, discusion y decisiones tomadas.\n• Usa la tabla de puntos de accion para responsable, fecha limite y seguimiento.\n• Alcance global o por area segun visibilidad.',
  tool_desc_goals:
    'Objetivos y Resultados Clave (OKRs).\n\n• Objetivo: meta cualitativa (ej. "Lanzar MVP").\n• Resultados clave: métricas medibles con barra de progreso.\n• Ajusta la barra según avance real.',
  tool_desc_eisenhower:
    'Matriz de priorización por urgencia e importancia.\n\n• Cuadrante 1: urgente e importante (hacer hoy).\n• Cuadrante 2: importante, no urgente (programar).\n• Cuadrante 3: urgente, no importante (delegar).\n• Cuadrante 4: ninguna (eliminar o posponer).',
  tool_desc_pugh:
    'Compara alternativas contra una opción de referencia.\n\n• Referencia: opción actual o baseline.\n• Alternativas: A, B, C…\n• Criterios: costo, tiempo, calidad…\n• Puntúa +1 (mejor), 0 (igual), -1 (peor). La opción con mayor total gana.',
  tool_desc_gantt:
    'Cronograma visual de tareas en el tiempo.\n\n• Crea un Gantt general o uno por área/proyecto específico.\n• Agrega elementos con fecha de inicio y fin.\n• Vincula opcionalmente un elemento a una tarea existente para dar seguimiento.\n• La línea roja marca el día de hoy.',
  tool_desc_sponsors:
    'Seguimiento de patrocinadores: nivel, aportación y estatus del contrato.\n\n• Nivel: Oro / Plata / Bronce.\n• Tipo de aportación: Dinero / Especie / Mixto.\n• Vencimiento: alerta automática cuando faltan 30 días o menos.\n• Haz clic en 🔍 para ver contactos, beneficios y notas de seguimiento.',
  tool_desc_logistics:
    'Logística de eventos: encargados, invitados, presupuesto y gastos.\n\n• Encargados: asigna integrantes del equipo desde la lista de membresías.\n• Invitados y gastos: haz clic en 🔍 para el desglose completo de cada evento.\n• Presupuesto cubierto: compara el costo aproximado contra lo cubierto por patrocinio.',
};

const TOOL_EXAMPLES = {
  tool_desc_kanban_example: 'Escribe "María" en la barra de búsqueda, filtra por área si tienes varias, haz clic en el nombre para asignar. La tarea aparecerá en la pestaña Tareas del asignado.',
  tool_desc_scrum_example: 'Crea un Sprint "Q1 Semana 3", añade tarjetas al backlog, asigna con la búsqueda (ej. "Carlos"), mueve las tarjetas entre columnas según avance.',
  tool_desc_retro_example: 'Tras un Sprint, añade puntos en "Qué salió bien" y "Qué mejorar", luego crea acciones concretas en la tercera columna.',
  tool_desc_availability_example: 'Crea una encuesta con varias fechas y horarios, pide al equipo marcar disponibilidad y fija como acuerdo el bloque con más coincidencias.',
  tool_desc_swot_example: 'Fortalezas: "Equipo con experiencia en Python". Debilidades: "Falta documentación". Oportunidades: "Nuevo cliente potencial". Amenazas: "Competencia fuerte".',
  tool_desc_eisenhower_example: 'Urgente e importante: bug en producción. Importante no urgente: refactorizar módulo. Urgente no importante: reunión que puede delegar. Ninguna: tarea obsoleta.',
  tool_desc_pugh_example: 'Referencia: "Sistema actual". Alternativas: A (Cloud), B (On-premise). Criterios: costo, escalabilidad, mantenimiento. Puntúa +1/-1 y suma.',
  tool_desc_goals_example: 'Objetivo: "Lanzar MVP en Q1". Resultados clave: "Completar 10 user stories", "Tests al 80%". Ajusta la barra de progreso según avance.',
  tool_desc_calendar_example: 'Evento global: "Competencia regional - 15 Mar". Evento por área: "Revisión de diseño Mecánica - 20 Mar" con alcance Mecánica.',
  tool_desc_meetings_example: 'Registra la agenda, resume la discusion, anota decisiones tomadas y asigna puntos de accion con responsable y fecha limite.',
  tool_desc_gantt_example: 'Gantt "Lanzamiento Q1": "Diseño" (1-10 Mar), "Prototipo" (8-20 Mar) vinculado a la tarea "Armar prototipo", "Pruebas" (18-28 Mar).',
  tool_desc_sponsors_example: '"Refrescos ACME" — Oro, en especie, $50,000 MXN, vence 31/12. "Banco Regional" — Oro, en dinero, $150,000 MXN, contacto: Claudia Reyes.',
  tool_desc_logistics_example: '"Feria de Emprendimiento 2026" — 17 Oct, Centro de Convenciones Norte, encargados: Carlos y Mariana, costo $85,000, cubierto $60,000, estatus: En preparación.',
};

const TOOL_LINKS = {
  tool_desc_kanban_link: 'https://es.wikipedia.org/wiki/Kanban',
  tool_desc_scrum_link: 'https://www.scrum.org/resources/what-is-scrum',
  tool_desc_retro_link: 'https://www.atlassian.com/team-playbook/plays/retrospective',
  tool_desc_availability_link: 'https://when2meet.com/',
  tool_desc_swot_link: 'https://es.wikipedia.org/wiki/An%C3%A1lisis_DAFO',
  tool_desc_eisenhower_link: 'https://es.wikipedia.org/wiki/Matriz_de_Eisenhower',
  tool_desc_pugh_link: 'https://en.wikipedia.org/wiki/Pugh_control',
  tool_desc_goals_link: 'https://es.wikipedia.org/wiki/Objetivos_y_resultados_clave',
  tool_desc_calendar_link: 'https://es.wikipedia.org/wiki/Calendario',
  tool_desc_meetings_link: 'https://www.atlassian.com/team-playbook/plays/meeting-notes',
  tool_desc_gantt_link: 'https://es.wikipedia.org/wiki/Diagrama_de_Gantt',
  tool_desc_sponsors_link: 'https://docs.google.com/spreadsheets/d/1iEeyGP12-0vefgFJFtqGyHUJINIjOU5UW4DcFdLK05s/edit',
};

/**
 * @param {{ descKey: string }} props
 */
export default function HowToUse({ descKey }) {
  const [open, setOpen] = useState(false);
  const description = TOOL_DESCRIPTIONS[descKey] || '';
  const example = TOOL_EXAMPLES[descKey + '_example'];
  const link = TOOL_LINKS[descKey + '_link'];
  const hasEx = !!example;
  const hasLn = !!link && link.startsWith('http');

  return (
    <div className="bg-slate-800/60 border border-hairline rounded-lg text-xs">
      <button onClick={() => setOpen((s) => !s)}
        className="w-full text-left px-3 py-2 flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors">
        <span className="font-semibold inline-flex items-center gap-1">
          <span className={`inline-block text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`}>▼</span>
          Cómo usar esta herramienta
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3 text-slate-400 leading-relaxed space-y-2">
          <p className="whitespace-pre-line">{description}</p>
          {hasEx && <p className="text-slate-500 text-[11px] italic">Ejemplo: {example}</p>}
          {hasLn && (
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline text-[11px] block">
              Más información →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
