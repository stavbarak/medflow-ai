import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
export declare class DocumentsController {
    private readonly documents;
    constructor(documents: DocumentsService);
    create(user: {
        id: string;
    }, dto: CreateDocumentDto): import(".prisma/client").Prisma.Prisma__MedicalDocumentClient<{
        appointment: {
            id: string;
            title: string;
            dateTime: Date;
        } | null;
        uploadedBy: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        createdAt: Date;
        notes: string;
        fileUrl: string;
        appointmentId: string | null;
        uploadedByUserId: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    findAll(): import(".prisma/client").Prisma.PrismaPromise<({
        appointment: {
            id: string;
            title: string;
            dateTime: Date;
        } | null;
        uploadedBy: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        createdAt: Date;
        notes: string;
        fileUrl: string;
        appointmentId: string | null;
        uploadedByUserId: string;
    })[]>;
    findOne(id: string): Promise<{
        appointment: {
            id: string;
            title: string;
            dateTime: Date;
        } | null;
        uploadedBy: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        createdAt: Date;
        notes: string;
        fileUrl: string;
        appointmentId: string | null;
        uploadedByUserId: string;
    }>;
}
