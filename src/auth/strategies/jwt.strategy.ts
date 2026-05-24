import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { toPublicUser, userWithMemberSelect } from '../../common/utils/user-profile';
import { FamilyMemberService } from '../../phone-allowlist/family-member.service';
import { JwtPayload } from '../../common/types/jwt-payload.interface';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly familyMembers: FamilyMemberService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: userWithMemberSelect,
    });
    if (!user) {
      throw new UnauthorizedException('משתמש לא נמצא');
    }
    if (!(await this.familyMembers.isAllowed(user.familyMember.phoneNumber))) {
      throw new UnauthorizedException('משתמש לא נמצא');
    }
    const publicUser = toPublicUser(user);
    return {
      id: publicUser.id,
      name: publicUser.name,
      phoneNumber: publicUser.phoneNumber,
      role: publicUser.role,
    };
  }
}
