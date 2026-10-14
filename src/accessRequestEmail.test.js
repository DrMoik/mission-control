import { describe, it, expect } from 'vitest';
import { accessRequestEmailUrl } from './accessRequestEmail.js';

describe('accessRequestEmailUrl', () => {
  it('builds an Outlook compose link with %20 spaces and all fields', () => {
    const url = accessRequestEmailUrl({
      visitors: 'Ana López + 2', origin: 'UNAM', reason: 'Visita', period: '20 de octubre',
      schedule: '9:00 a 14:00', location: 'Taller Quantum', responsible: 'Dr. Gálvez',
    });
    expect(url.startsWith('https://outlook.office.com/mail/deeplink/compose?')).toBe(true);
    expect(url).not.toMatch(/\+(?!2)/); // no '+' standing in for spaces
    const p = new URL(url).searchParams;
    expect(p.get('to')).toBe('seguridad.cem@servicios.itesm.mx');
    expect(p.get('subject')).toBe('Solicitud de acceso al campus — 20 de octubre');
    expect(p.get('body')).toContain('visitante(s): Ana López + 2');
    expect(p.get('body')).toContain('Horario de visita: 9:00 a 14:00');
  });
});
