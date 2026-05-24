import { Global, Module } from '@nestjs/common';
import { FamilyMemberService } from './family-member.service';
import { FamilyPersonaService } from './family-persona.service';

@Global()
@Module({
  providers: [FamilyMemberService, FamilyPersonaService],
  exports: [FamilyMemberService, FamilyPersonaService],
})
export class PhoneAllowlistModule {}
