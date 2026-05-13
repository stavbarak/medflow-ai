import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findOne(id: string): Promise<{
        id: string;
        phoneNumber: string;
        name: string;
        role: string | null;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    update(userId: string, dto: UpdateUserDto): Promise<{
        id: string;
        phoneNumber: string;
        name: string;
        role: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
