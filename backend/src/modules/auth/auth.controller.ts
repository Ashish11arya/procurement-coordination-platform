import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService, ClientMetadata } from './services/auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterFarmerDto } from './dto/register-farmer.dto';
import { LoginOperatorDto } from './dto/login-operator.dto';
import { CreateOperatorDto } from './dto/create-operator.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Public } from '../../shared/decorators/public.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Role } from '../../shared/enums/roles.enum';
import { AuthenticatedUser } from '../../shared/types/auth.types';

@Controller('auth')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 1. Farmer Request OTP
   */
  @Public()
  @Post('farmer/otp/request')
  @HttpCode(HttpStatus.OK)
  async requestFarmerOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestFarmerOtp(dto);
  }

  /**
   * 2. Farmer Verify OTP & Login
   */
  @Public()
  @Post('farmer/otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyFarmerOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const meta = this.extractClientMeta(req);
    const result = await this.authService.verifyFarmerOtp(dto, meta);

    this.setRefreshTokenCookie(res, result.tokens.refreshToken);

    return {
      message: 'Authentication successful',
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.expiresIn,
    };
  }

  /**
   * 3. Farmer Self-Registration
   */
  @Public()
  @Post('farmer/register')
  @HttpCode(HttpStatus.CREATED)
  async registerFarmer(
    @Body() dto: RegisterFarmerDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const meta = this.extractClientMeta(req);
    const result = await this.authService.registerFarmer(dto, meta);

    this.setRefreshTokenCookie(res, result.tokens.refreshToken);

    return {
      message: 'Farmer registered successfully',
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.expiresIn,
    };
  }

  /**
   * 4. Operator / Government Login
   */
  @Public()
  @Post('operator/login')
  @HttpCode(HttpStatus.OK)
  async loginOperator(
    @Body() dto: LoginOperatorDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const meta = this.extractClientMeta(req);
    const result = await this.authService.loginOperator(dto, meta);

    this.setRefreshTokenCookie(res, result.tokens.refreshToken);

    return {
      message: 'Login successful',
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.expiresIn,
    };
  }

  /**
   * 5. Create Operator / Admin Account
   * Restricted to SYSTEM_ADMIN and CENTRE_ADMIN
   */
  @Post('operator/create')
  @Roles(Role.SYSTEM_ADMIN, Role.CENTRE_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createOperator(
    @Body() dto: CreateOperatorDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const meta = this.extractClientMeta(req);
    const newOperator = await this.authService.createOperator(dto, user, meta);
    return {
      message: 'Operator created successfully',
      operator: newOperator,
    };
  }

  /**
   * 6. Rotate Refresh Token
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') bodyRefreshToken?: string,
  ) {
    const rawToken = req.cookies?.['refresh_token'] || bodyRefreshToken;
    const meta = this.extractClientMeta(req);

    const tokens = await this.authService.rotateRefreshToken(rawToken, meta);
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return {
      message: 'Token rotated successfully',
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    };
  }

  /**
   * 7. Logout
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = req.cookies?.['refresh_token'];
    const meta = this.extractClientMeta(req);

    await this.authService.logout(rawRefreshToken, user, meta);
    this.clearRefreshTokenCookie(res);

    return { message: 'Logged out successfully' };
  }

  /**
   * 8. Current Authenticated Profile
   */
  @Get('me')
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  // ==========================================
  // Private Cookie & Metadata Utilities
  // ==========================================

  private extractClientMeta(req: Request): ClientMetadata {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'],
      requestId: (req.headers['x-request-id'] as string) || `req-${Date.now()}`,
    };
  }

  private setRefreshTokenCookie(res: Response, token: string) {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      path: '/api/v1/auth',
    });
  }

  private clearRefreshTokenCookie(res: Response) {
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
    });
  }
}
