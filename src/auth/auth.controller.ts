import {
  Body,
  Controller,
  HttpCode,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(200)
  async register(@Body() dto: RegisterDto, @Res() res: Response) {
    const data = await this.auth.register(dto);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(data);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res() res: Response) {
    const data = await this.auth.login(dto);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(data);
  }

  @Post('forgot-password')
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Res() res: Response,
  ) {
    const data = await this.auth.forgotPassword(dto);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(data);
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto, @Res() res: Response) {
    const data = await this.auth.resetPassword(dto);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(data);
  }
}
