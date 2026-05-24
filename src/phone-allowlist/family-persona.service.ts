import { Injectable } from '@nestjs/common';
import { Gender } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  type FamilyPersona,
  type ResolvedTransport,
  formatFamilyPersonasForPrompt,
  namesMatch,
  personaNameFromLabel,
} from '../common/utils/family-persona';

@Injectable()
export class FamilyPersonaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Roster for AI prompts (allowlist labels + registered users). */
  async getPersonas(): Promise<FamilyPersona[]> {
    const byName = new Map<string, FamilyPersona>();

    const allowed = await this.prisma.allowedPhone.findMany({
      where: { gender: { not: null } },
      select: { label: true, gender: true, phoneNumber: true },
    });
    for (const row of allowed) {
      const name = personaNameFromLabel(row.label);
      if (name && row.gender) {
        byName.set(name, { name, gender: row.gender });
      }
    }

    const users = await this.prisma.user.findMany({
      select: { id: true, name: true, gender: true },
    });
    for (const u of users) {
      const name = u.name.trim();
      if (name.length >= 2 && u.gender) {
        byName.set(name, { name, gender: u.gender, userId: u.id });
      }
    }

    return [...byName.values()].sort((a, b) =>
      a.name.localeCompare(b.name, 'he'),
    );
  }

  async getPromptBlock(): Promise<string> {
    return formatFamilyPersonasForPrompt(await this.getPersonas());
  }

  async findGenderForPhone(phoneNumber: string): Promise<Gender | null> {
    const row = await this.prisma.allowedPhone.findUnique({
      where: { phoneNumber },
      select: { gender: true },
    });
    return row?.gender ?? null;
  }

  /** Resolve driver name from extraction to a registered User when possible. */
  async findUserByDriverName(driverName: string) {
    const hint = driverName.trim();
    if (!hint) {
      return null;
    }

    const users = await this.prisma.user.findMany({
      select: { id: true, name: true, gender: true, phoneNumber: true },
    });
    for (const u of users) {
      if (namesMatch(hint, u.name)) {
        return u;
      }
    }

    const allowed = await this.prisma.allowedPhone.findMany({
      select: { label: true, phoneNumber: true },
    });
    for (const row of allowed) {
      const labelName = personaNameFromLabel(row.label);
      if (labelName && namesMatch(hint, labelName)) {
        const user = await this.prisma.user.findUnique({
          where: { phoneNumber: row.phoneNumber },
          select: { id: true, name: true, gender: true, phoneNumber: true },
        });
        if (user) {
          return user;
        }
      }
    }

    return null;
  }

  async genderForDriverName(driverName: string): Promise<Gender | null> {
    const user = await this.findUserByDriverName(driverName);
    if (user?.gender) {
      return user.gender;
    }
    const personas = await this.getPersonas();
    const match = personas.find((p) => namesMatch(driverName, p.name));
    return match?.gender ?? null;
  }

  /**
   * Map AI extraction to DB fields: transportUserId + transportNotes.
   * Falls back to legacy single "transport" string when model returns old shape.
   */
  async resolveTransportFromExtraction(input: {
    transportDriver?: string | null;
    transportNotes?: string | null;
    legacyTransport?: string | null;
  }): Promise<ResolvedTransport> {
    let driverName = input.transportDriver?.trim() || null;
    let notes = input.transportNotes?.trim() ?? '';

    const legacy = input.legacyTransport?.trim();
    if (!driverName && legacy) {
      const personas = await this.getPersonas();
      for (const p of personas) {
        if (legacy.includes(p.name)) {
          driverName = p.name;
          notes = legacy.replace(p.name, '').replace(/\s+/g, ' ').trim() || notes;
          break;
        }
      }
      if (!driverName) {
        return {
          transportUserId: null,
          transportNotes: legacy,
          driverName: null,
          driverGender: null,
        };
      }
    }

    if (!driverName) {
      return {
        transportUserId: null,
        transportNotes: notes,
        driverName: null,
        driverGender: null,
      };
    }

    const user = await this.findUserByDriverName(driverName);
    const gender = user?.gender ?? (await this.genderForDriverName(driverName));

    if (!user?.id) {
      const combined = [driverName, notes].filter(Boolean).join('. ');
      return {
        transportUserId: null,
        transportNotes: combined,
        driverName,
        driverGender: gender,
      };
    }

    return {
      transportUserId: user.id,
      transportNotes: notes,
      driverName,
      driverGender: gender,
    };
  }
}
