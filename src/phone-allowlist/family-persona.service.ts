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

  async getPersonas(): Promise<FamilyPersona[]> {
    const members = await this.prisma.familyMember.findMany({
      select: {
        displayName: true,
        gender: true,
        user: { select: { id: true } },
      },
      orderBy: { displayName: 'asc' },
    });
    return members.map((m) => ({
      name: personaNameFromLabel(m.displayName) ?? m.displayName,
      gender: m.gender,
      userId: m.user?.id,
    }));
  }

  async getPromptBlock(): Promise<string> {
    return formatFamilyPersonasForPrompt(await this.getPersonas());
  }

  async findGenderForPhone(phoneNumber: string): Promise<Gender | null> {
    const row = await this.prisma.familyMember.findUnique({
      where: { phoneNumber },
      select: { gender: true },
    });
    return row?.gender ?? null;
  }

  async findUserByDriverName(driverName: string) {
    const hint = driverName.trim();
    if (!hint) {
      return null;
    }

    const members = await this.prisma.familyMember.findMany({
      select: {
        displayName: true,
        phoneNumber: true,
        gender: true,
        user: {
          select: { id: true },
        },
      },
    });

    for (const m of members) {
      const name = personaNameFromLabel(m.displayName) ?? m.displayName;
      if (!namesMatch(hint, name)) {
        continue;
      }
      if (m.user) {
        return {
          id: m.user.id,
          name,
          phoneNumber: m.phoneNumber,
          gender: m.gender,
        };
      }
    }

    return null;
  }

  async genderForDriverName(driverName: string): Promise<Gender | null> {
    const user = await this.findUserByDriverName(driverName);
    if (user) {
      return user.gender;
    }
    const personas = await this.getPersonas();
    const match = personas.find((p) => namesMatch(driverName, p.name));
    return match?.gender ?? null;
  }

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
