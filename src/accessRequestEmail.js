// Campus access requests (Quantum Robotics): who approves, where the email goes,
// and the prefilled Outlook (Microsoft 365) draft. The approver email is also
// hard-coded in firestore.rules (isAccessApprover) — change both together.

export const ACCESS_APPROVER_EMAIL = 'm.galvez@tec.mx';
export const ACCESS_SECURITY_EMAIL = 'seguridad.cem@servicios.itesm.mx';

/** True for teams that get the Solicitudes de acceso feature. */
export const isQuantumTeam = (team) => /quantum/i.test(team?.name || '');

export const accessRequestEmailBody = (r) => [
  'Buen día,',
  '',
  'Por medio del presente solicito de la manera más atenta su apoyo para autorizar el acceso al campus de la(s) siguiente(s) persona(s):',
  '',
  `• Nombre de la(s) persona(s) visitante(s): ${r.visitors}`,
  `• Escuela/empresa de procedencia: ${r.origin}`,
  `• Motivo de ingreso: ${r.reason}`,
  `• Día o periodo del acceso: ${r.period}`,
  `• Horario de visita: ${r.schedule}`,
  `• Ubicación en el campus donde llevará a cabo sus actividades: ${r.location}`,
  `• Responsable de la visita: ${r.responsible}`,
  '',
  'Quedo atento a cualquier comentario.',
  '',
  'Saludos cordiales,',
  '',
  'Dr. Miguel Ángel Gálvez Zúñiga',
  ACCESS_APPROVER_EMAIL,
].join('\n');

export const accessRequestEmailSubject = (r) => `Solicitud de acceso al campus — ${r.period}`;

/** Outlook on the web compose deeplink; sends from the signed-in Microsoft 365 account. */
export const accessRequestEmailUrl = (r) => {
  const params = new URLSearchParams({
    to: ACCESS_SECURITY_EMAIL,
    subject: accessRequestEmailSubject(r),
    body: accessRequestEmailBody(r),
  });
  // URLSearchParams encodes spaces as '+', which Outlook shows literally.
  return `https://outlook.office.com/mail/deeplink/compose?${params.toString().replace(/\+/g, '%20')}`;
};
