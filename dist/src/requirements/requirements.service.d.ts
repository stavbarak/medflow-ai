import { PrismaService } from '../prisma/prisma.service';
import { CreateRequirementDto } from './dto/create-requirement.dto';
import { UpdateRequirementDto } from './dto/update-requirement.dto';
export declare class RequirementsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(appointmentId: string, dto: CreateRequirementDto): Promise<{
        id: string;
        description: string;
        isDone: boolean;
        appointmentId: string;
    }>;
    findAllForAppointment(appointmentId: string): Promise<{
        id: string;
        description: string;
        isDone: boolean;
        appointmentId: string;
    }[]>;
    update(appointmentId: string, requirementId: string, dto: UpdateRequirementDto): Promise<{
        id: string;
        description: string;
        isDone: boolean;
        appointmentId: string;
    }>;
    remove(appointmentId: string, requirementId: string): Promise<{
        id: string;
        description: string;
        isDone: boolean;
        appointmentId: string;
    }>;
    private ensureAppointment;
}
