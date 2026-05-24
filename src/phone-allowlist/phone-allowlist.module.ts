import { Global, Module } from '@nestjs/common';
import { FamilyPersonaService } from './family-persona.service';
import { PhoneAllowlistService } from './phone-allowlist.service';

@Global()
@Module({
  providers: [PhoneAllowlistService, FamilyPersonaService],
  exports: [PhoneAllowlistService, FamilyPersonaService],
})
export class PhoneAllowlistModule {}
