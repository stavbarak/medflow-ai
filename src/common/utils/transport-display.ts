import { Gender } from '@prisma/client';
import { adaptHebrewForPatientSecondPerson } from './patient-address';

export type TransportDriver = {
  name: string;
  gender: Gender | null;
};

/** Build Hebrew transport line from linked user + optional notes. */
export function formatTransportHebrew(opts: {
  driver?: TransportDriver | null;
  transportNotes?: string | null;
  addressSecondPerson?: boolean;
}): string {
  const parts: string[] = [];
  const driver = opts.driver;
  const notes = opts.transportNotes?.trim() ?? '';

  if (driver?.name) {
    const verb =
      driver.gender === 'female'
        ? 'תסיע'
        : driver.gender === 'male'
          ? 'יסיע'
          : 'יסיע';
    const object = opts.addressSecondPerson ? 'אותך' : 'אותו';
    parts.push(`${driver.name} ${verb} ${object}`);
  }

  if (notes) {
    const driverName = driver?.name ?? '';
    if (!driverName || !notes.includes(driverName)) {
      parts.push(notes);
    } else if (!driver?.name) {
      parts.push(notes);
    }
  }

  let line = parts.join('. ').trim();
  if (opts.addressSecondPerson && line) {
    line = adaptHebrewForPatientSecondPerson(line);
  }
  return line;
}
