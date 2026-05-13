import { RequirementsService } from './requirements.service';
import { CreateRequirementDto } from './dto/create-requirement.dto';
import { UpdateRequirementDto } from './dto/update-requirement.dto';
export declare class RequirementsController {
    private readonly requirements;
    constructor(requirements: RequirementsService);
    create(appointmentId: string, dto: CreateRequirementDto): Promise<{
        id: string;
        description: string;
        isDone: boolean;
        appointmentId: string;
    }>;
    findAll(appointmentId: string): Promise<{
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
}
