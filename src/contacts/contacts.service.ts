import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateContactDto) {
    return this.prisma.usefulContact.create({
      data: {
        name: dto.name.trim(),
        value: dto.value.trim(),
        notes: dto.notes?.trim() ?? '',
      },
    });
  }

  findAll() {
    return this.prisma.usefulContact.findMany({ orderBy: { name: 'asc' } });
  }

  async update(id: string, dto: UpdateContactDto) {
    await this.ensureExists(id);
    return this.prisma.usefulContact.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        value: dto.value?.trim(),
        notes: dto.notes?.trim(),
      },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.usefulContact.delete({ where: { id } });
  }

  /** Case-insensitive lookup by (partial) name, for the WhatsApp save flow. */
  findByName(name: string) {
    return this.prisma.usefulContact.findFirst({
      where: { name: { contains: name.trim(), mode: 'insensitive' } },
    });
  }

  private async ensureExists(id: string) {
    const n = await this.prisma.usefulContact.count({ where: { id } });
    if (!n) {
      throw new NotFoundException('מספר לא נמצא');
    }
  }
}
