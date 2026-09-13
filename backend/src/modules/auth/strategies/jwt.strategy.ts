import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request } from 'express';
import { User, UserDocument } from '../schemas/user.schema';
import { JwtPayload, AuthenticatedUser } from '../../../shared/types/auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1. From Authorization Bearer Header
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // 2. From Secure Cookie fallback
        (req: Request) => {
          return req?.cookies?.['access_token'] || null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_ACCESS_SECRET',
        'dev_jwt_access_secret_change_in_production_min32chars',
      ),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.userModel.findById(payload.sub).select('+tokenVersion').exec();

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account does not exist or has been deactivated.');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account is temporarily locked. Please try again later.');
    }

    // Check tokenVersion for immediate server-side revocation on password change or logout
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Session has expired or been revoked. Please log in again.');
    }

    return {
      userId: user._id.toString(),
      role: user.role,
      permissions: payload.permissions || [],
      scope: user.scope || {},
      mobile: user.mobile,
      email: user.email,
      name: user.name,
      tokenVersion: user.tokenVersion,
    };
  }
}
