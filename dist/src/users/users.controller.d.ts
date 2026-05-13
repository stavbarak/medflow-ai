import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersController {
    private readonly users;
    constructor(users: UsersService);
    me(user: AuthenticatedUser): Promise<{
        id: string;
        phoneNumber: string;
        name: string;
        role: string | null;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    updateMe(user: AuthenticatedUser, dto: UpdateUserDto): Promise<{
        id: string;
        phoneNumber: string;
        name: string;
        role: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
