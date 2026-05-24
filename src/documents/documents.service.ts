import { Injectable, NotFoundException } from '@nestjs/common';
import {
  transportUserDisplay,
  transportUserSelect,
} from '../common/utils/user-profile';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';

const documentInclude = {
  appointment: {
    select: { id: true, title: true, dateTime: true },
  },
  uploadedBy: { select: transportUserSelect },
} as const;

function mapDocument<
  T extends {
    uploadedBy: Parameters<typeof transportUserDisplay>[0];
  },
>(doc: T) {
  const uploader = transportUserDisplay(doc.uploadedBy);
  return {
    ...doc,
    uploadedBy: uploader
      ? { id: uploader.id, name: uploader.name }
      : { id: '', name: '' },
  };
}

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateDocumentDto) {
    const doc = await this.prisma.medicalDocument.create({
      data: {
        appointmentId: dto.appointmentId,
        fileUrl: dto.fileUrl,
        notes: dto.notes ?? '',
        uploadedByUserId: userId,
      },
      include: documentInclude,
    });
    return mapDocument(doc);
  }

  async findAll() {
    const docs = await this.prisma.medicalDocument.findMany({
      orderBy: { createdAt: 'desc' },
      include: documentInclude,
    });
    return docs.map(mapDocument);
  }

  async findOne(id: string) {
    const doc = await this.prisma.medicalDocument.findUnique({
      where: { id },
      include: documentInclude,
    });
    if (!doc) {
      throw new NotFoundException('מסמך לא נמצא');
    }
    return mapDocument(doc);
  }
}
