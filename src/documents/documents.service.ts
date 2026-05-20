import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateDocumentDto) {
    return this.prisma.medicalDocument.create({
      data: {
        appointmentId: dto.appointmentId,
        fileUrl: dto.fileUrl,
        notes: dto.notes ?? '',
        uploadedByUserId: userId,
      },
      include: {
        appointment: {
          select: { id: true, title: true, dateTime: true },
        },
        uploadedBy: {
          select: { id: true, name: true },
        },
      },
    });
  }

  findAll() {
    return this.prisma.medicalDocument.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        appointment: {
          select: { id: true, title: true, dateTime: true },
        },
        uploadedBy: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const doc = await this.prisma.medicalDocument.findUnique({
      where: { id },
      include: {
        appointment: {
          select: { id: true, title: true, dateTime: true },
        },
        uploadedBy: {
          select: { id: true, name: true },
        },
      },
    });
    if (!doc) {
      throw new NotFoundException('מסמך לא נמצא');
    }
    return doc;
  }
}
