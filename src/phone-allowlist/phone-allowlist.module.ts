import { Global, Module } from '@nestjs/common';
import { PhoneAllowlistService } from './phone-allowlist.service';

@Global()
@Module({
  providers: [PhoneAllowlistService],
  exports: [PhoneAllowlistService],
})
export class PhoneAllowlistModule {}
