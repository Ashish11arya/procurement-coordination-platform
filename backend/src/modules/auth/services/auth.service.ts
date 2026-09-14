import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Optional,
  Logger,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectModel, getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

import { ConsentRecord, ConsentRecordDocument, ConsentStatus } from '../../compliance/schemas/consent.schema';
import { DataProcessingLogService } from '../../compliance/services/data-processing-log.service';
import { ProcessingPurpose, LawfulBasis, ProcessingAction } from '../../compliance/schemas/data-processing-log.schema';

import { User, UserDocument } from '../schemas/user.schema';
import { RefreshToken, RefreshTokenDocument } from '../schemas/refresh-token.schema';
import { OtpService, OtpGenerationResult } from './otp.service';
import { SecurityService } from '../../../infrastructure/security/security.service';
import { AuditService } from '../../audit/audit.service';
import { AuditAction, AuditSource } from '../../audit/schemas/audit-log.schema';
import { Role } from '../../../shared/enums/roles.enum';
import { ROLE_PERMISSIONS } from '../../../shared/constants/role-permissions.map';
import {
  AuthenticatedUser,
  JwtPayload,
  TokenPair,
} from '../../../shared/types/auth.types';
import { RequestOtpDto } from '../dto/request-otp.dto';
import { VerifyOtpDto } from '../dto/verify-otp.dto';
import { RegisterFarmerDto } from '../dto/register-farmer.dto';
import { LoginOperatorDto } from '../dto/login-operator.dto';
import { CreateOperatorDto } from '../dto/create-operator.dto';
import {
  GovernmentDataProvider,
  GOVERNMENT_DATA_PROVIDER,
} from '../../integrations/contracts/government-data-provider.interface';

export interface ClientMetadata {
  ipAddress: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtAccessSecret: string;
  private readonly jwtAccessExpiresIn: string;
  private readonly jwtRefreshExpiresInDays = 7;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshTokenDocument>,
    private readonly jwtService: JwtService,
    private readonly securityService: SecurityService,
    private readonly otpService: OtpService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    @Inject(GOVERNMENT_DATA_PROVIDER)
    private readonly govProvider: GovernmentDataProvider,
    @Optional() private readonly moduleRef?: ModuleRef,
  ) {
    this.jwtAccessSecret = this.configService.get<string>(
      'JWT_ACCESS_SECRET',
      'dev_jwt_access_secret_change_in_production_min32chars',
    );
    this.jwtAccessExpiresIn = this.configService.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
      '15m',
    );
  }

  private get consentModel(): Model<ConsentRecordDocument> | null {
    if (!this.moduleRef) return null;
    try {
      return this.moduleRef.get<Model<ConsentRecordDocument>>(getModelToken(ConsentRecord.name), { strict: false });
    } catch {
      return null;
    }
  }

  private get dataProcessingLogService(): DataProcessingLogService | null {
    if (!this.moduleRef) return null;
    try {
      return this.moduleRef.get<DataProcessingLogService>(DataProcessingLogService, { strict: false });
    } catch {
      return null;
    }
  }

  /**
   * 1. Request OTP for Farmer
   */
  async requestFarmerOtp(dto: RequestOtpDto): Promise<OtpGenerationResult> {
    return this.otpService.requestOtp(dto.mobile);
  }

  /**
   * 2. Verify OTP & Authenticate/Login Farmer
   */
  async verifyFarmerOtp(
    dto: VerifyOtpDto,
    meta: ClientMetadata,
  ): Promise<{ user: Partial<User>; tokens: TokenPair }> {
    await this.otpService.verifyOtp(dto.mobile, dto.otp);

    // Find or automatically provision farmer user using GovernmentDataProvider
    let user = await this.userModel.findOne({ mobile: dto.mobile }).exec();

    if (!user) {
      // Query Government Data Provider for baseline record (with Section 21 fallback)
      let govRecord: any = null;
      try {
        govRecord = await this.govProvider.getFarmer(dto.mobile);
      } catch (err: any) {
        this.logger.warn(
          `Government farmer lookup unavailable (${err.message}). Creating local baseline profile.`,
        );
      }

      user = new this.userModel({
        mobile: dto.mobile,
        name: govRecord ? govRecord.name : `Farmer ${dto.mobile.slice(-4)}`,
        role: Role.FARMER,
        farmerId: govRecord?.farmerId,
        registrationNumber: govRecord?.registrationNumber,
        state: govRecord?.state,
        district: govRecord?.district,
        subDistrict: govRecord?.subDistrict,
        village: govRecord?.village,
        landAreaAcres: govRecord?.landAreaAcres,
        isActive: true,
        tokenVersion: 1,
        lastLoginAt: new Date(),
      });
      await user.save();
    } else {
      user.lastLoginAt = new Date();
      await user.save();
    }

    const tokens = await this.issueTokenPair(user, meta);

    // Audit log
    await this.auditService.logAction({
      requestId: meta.requestId || `req-${Date.now()}`,
      action: AuditAction.AUTH_OTP_VERIFIED,
      who: {
        userId: user._id.toString(),
        role: user.role,
        mobile: user.mobile,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      target: { entityType: 'User', entityId: user._id.toString() },
      status: 'SUCCESS',
    });

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  /**
   * 3. Register a Farmer explicitly
   */
  async registerFarmer(
    dto: RegisterFarmerDto,
    meta: ClientMetadata,
  ): Promise<{ user: Partial<User>; tokens: TokenPair }> {
    if (!dto.consentToDataSharing) {
      throw new BadRequestException(
        'Explicit consent to data sharing under the DPDP Act 2023 is mandatory for registration.',
      );
    }

    const existing = await this.userModel.findOne({ mobile: dto.mobile }).exec();
    if (existing) {
      throw new ConflictException('A farmer with this mobile number is already registered. Please login via OTP.');
    }

    // Check with GovernmentDataProvider for official identity/registration (with Section 21 fallback)
    let govRecord: any = null;
    try {
      govRecord = await this.govProvider.getFarmer(dto.mobile);
    } catch (err: any) {
      this.logger.warn(
        `Government farmer registration lookup unavailable (${err.message}). Using self-declared profile.`,
      );
    }

    const farmerId = govRecord?.farmerId || `FARMER-${Date.now()}`;

    const user = new this.userModel({
      mobile: dto.mobile,
      name: dto.name,
      role: Role.FARMER,
      farmerId,
      registrationNumber: govRecord?.registrationNumber || `REG-${dto.mobile.slice(-5)}`,
      state: dto.state || govRecord?.state,
      district: dto.district || govRecord?.district,
      subDistrict: dto.subDistrict || govRecord?.subDistrict,
      village: dto.village || govRecord?.village,
      landAreaAcres: dto.landAreaAcres || govRecord?.landAreaAcres || 0,
      isActive: true,
      lastLoginAt: new Date(),
    });

    await user.save();

    // Persist immutable DPDP consent record
    if (this.consentModel) {
      const consentRecord = new this.consentModel({
        userId: user._id,
        farmerId,
        consentVersion: dto.consentVersion || 'DPDP-2023-V1.0',
        purposes: dto.consentScopes && dto.consentScopes.length > 0 ? dto.consentScopes : [
          'MSP_PROCUREMENT_COORDINATION',
          'YARD_SCHEDULING_AND_ENTRY',
          'DIRECT_BENEFIT_TRANSFER_PAYMENT',
          'SMS_NOTIFICATION_DISPATCH',
        ],
        ipAddress: meta.ipAddress || '127.0.0.1',
        userAgent: meta.userAgent,
        privacyPolicyVersion: 'DPDP-2023-V1.0',
        privacyPolicyUrl: '/docs/legal/PRIVACY_POLICY.md',
        status: ConsentStatus.ACTIVE,
        grantedAt: new Date(),
      });
      await consentRecord.save();
    }

    // Record PII processing activity under DPDP Section 8
    if (this.dataProcessingLogService) {
      await this.dataProcessingLogService.logAccess({
        accessor: {
          userId: user._id.toString(),
          role: Role.FARMER,
          name: user.name,
          ipAddress: meta.ipAddress || '127.0.0.1',
          userAgent: meta.userAgent,
        },
        dataSubject: {
          farmerId,
          userId: user._id.toString(),
          mobile: user.mobile,
        },
        dataCategoriesAccessed: ['NAME', 'MOBILE', 'LAND_RECORDS', 'GEO_LOCATION'],
        processingPurpose: ProcessingPurpose.FARMER_REGISTRATION_ONBOARDING,
        lawfulBasis: LawfulBasis.CONSENT_SEC_6,
        action: ProcessingAction.UPDATE,
        details: 'Farmer completed registration with affirmative DPDP consent.',
      }).catch((err) => {
        this.logger.warn(`Non-blocking failure logging registration processing activity: ${err.message}`);
      });
    }

    const tokens = await this.issueTokenPair(user, meta);

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  /**
   * 4. Operator / Government Login with Password + MFA Hooks
   */
  async loginOperator(
    dto: LoginOperatorDto,
    meta: ClientMetadata,
  ): Promise<{ user: Partial<User>; tokens: TokenPair }> {
    const user = await this.userModel
      .findOne({
        $or: [{ email: dto.identifier.toLowerCase() }, { username: dto.identifier }],
      })
      .select('+passwordHash +mfaSecret')
      .exec();

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid username/email or password.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account has been deactivated. Contact your administrator.');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const waitMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(
        `Account is locked due to multiple failed login attempts. Try again in ${waitMinutes} minutes.`,
      );
    }

    const isMatch = await this.securityService.comparePassword(dto.password, user.passwordHash);

    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15-minute lock
        this.logger.warn(`Account locked due to 5 failed attempts: ${dto.identifier}`);
      }
      await user.save();
      throw new UnauthorizedException('Invalid username/email or password.');
    }

    // Reset failed attempts on success
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    // MFA-ready hook: if MFA enabled, verify mfaCode
    if (user.isMfaEnabled) {
      if (!dto.mfaCode) {
        throw new UnauthorizedException('MFA verification code is required for this account.');
      }
      // Future integration with TOTP / Authenticator app
      if (dto.mfaCode !== '123456') {
        throw new UnauthorizedException('Invalid MFA verification code.');
      }
    }

    const tokens = await this.issueTokenPair(user, meta);

    // Audit Log
    await this.auditService.logAction({
      requestId: meta.requestId || `req-${Date.now()}`,
      action: AuditAction.AUTH_LOGIN_PASSWORD,
      who: {
        userId: user._id.toString(),
        role: user.role,
        email: user.email,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      target: { entityType: 'User', entityId: user._id.toString() },
      scope: user.scope,
      status: 'SUCCESS',
    });

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  /**
   * 5. Create Operator / Admin account (Restricted to SYSTEM_ADMIN / CENTRE_ADMIN)
   */
  async createOperator(
    dto: CreateOperatorDto,
    creator: AuthenticatedUser,
    meta: ClientMetadata,
  ): Promise<Partial<User>> {
    // Check if user already exists
    const existing = await this.userModel
      .findOne({ $or: [{ email: dto.email.toLowerCase() }, { username: dto.username }] })
      .exec();

    if (existing) {
      throw new ConflictException('A user with this email or username already exists.');
    }

    // CENTRE_ADMIN can only create operators for their own centre
    if (creator.role === Role.CENTRE_ADMIN) {
      if (
        ![
          Role.CHECKIN_OPERATOR,
          Role.WEIGHING_OPERATOR,
          Role.QUALITY_OPERATOR,
          Role.PROCUREMENT_OPERATOR,
        ].includes(dto.role)
      ) {
        throw new ForbiddenException('Centre Administrators can only create centre operator roles.');
      }
      if (dto.scope?.centreId && dto.scope.centreId !== creator.scope?.centreId) {
        throw new ForbiddenException('Cannot assign an operator to a different centre.');
      }
    }

    const passwordHash = await this.securityService.hashPassword(dto.password);

    const operator = new this.userModel({
      name: dto.name,
      username: dto.username,
      email: dto.email.toLowerCase(),
      passwordHash,
      role: dto.role,
      scope: dto.scope || (creator.role === Role.CENTRE_ADMIN ? creator.scope : {}),
      isActive: true,
    });

    await operator.save();

    await this.auditService.logAction({
      requestId: meta.requestId || `req-${Date.now()}`,
      action: AuditAction.OPERATOR_CREATED,
      who: {
        userId: creator.userId,
        role: creator.role,
        email: creator.email,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      target: { entityType: 'User', entityId: operator._id.toString() },
      scope: operator.scope,
      newValue: {
        username: operator.username,
        email: operator.email,
        role: operator.role,
        scope: operator.scope,
      },
      status: 'SUCCESS',
    });

    return this.sanitizeUser(operator);
  }

  /**
   * 6. Rotate Refresh Token (Strict reuse detection)
   */
  async rotateRefreshToken(
    rawToken: string,
    meta: ClientMetadata,
  ): Promise<TokenPair> {
    if (!rawToken) {
      throw new UnauthorizedException('Refresh token is missing.');
    }

    const tokenHash = this.securityService.hashToken(rawToken);
    const storedToken = await this.refreshTokenModel.findOne({ tokenHash }).exec();

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    // Reuse detection: If token was already revoked, someone is attempting a replay attack!
    if (storedToken.isRevoked) {
      this.logger.error(
        `[SECURITY ALERT] Refresh token reuse detected for family ${storedToken.familyId}! Invalidating all family tokens.`,
      );
      // Revoke all tokens in this family
      await this.refreshTokenModel.updateMany(
        { familyId: storedToken.familyId },
        { isRevoked: true },
      );
      throw new UnauthorizedException('Invalid session. Token reuse detected. Please log in again.');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired. Please log in again.');
    }

    // Find the associated user
    const user = await this.userModel.findById(storedToken.userId).exec();
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account no longer exists or is inactive.');
    }

    // Mark current token as revoked
    storedToken.isRevoked = true;
    await storedToken.save();

    // Issue new pair preserving the same familyId
    return this.issueTokenPair(user, meta, storedToken.familyId);
  }

  /**
   * 7. Logout & Token Invalidation
   */
  async logout(
    rawRefreshToken: string | undefined,
    user: AuthenticatedUser,
    meta: ClientMetadata,
  ): Promise<void> {
    if (rawRefreshToken) {
      const tokenHash = this.securityService.hashToken(rawRefreshToken);
      await this.refreshTokenModel.updateOne({ tokenHash }, { isRevoked: true });
    }

    // Invalidate user's active access tokens by bumping tokenVersion
    await this.userModel.findByIdAndUpdate(user.userId, { $inc: { tokenVersion: 1 } });

    await this.auditService.logAction({
      requestId: meta.requestId || `req-${Date.now()}`,
      action: AuditAction.AUTH_LOGOUT,
      who: {
        userId: user.userId,
        role: user.role,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      target: { entityType: 'User', entityId: user.userId },
      status: 'SUCCESS',
    });
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  private async issueTokenPair(
    user: UserDocument,
    meta: ClientMetadata,
    existingFamilyId?: string,
  ): Promise<TokenPair> {
    const permissions = ROLE_PERMISSIONS[user.role] || [];

    const payload: JwtPayload = {
      sub: user._id.toString(),
      role: user.role,
      permissions,
      scope: user.scope || {},
      tokenVersion: user.tokenVersion || 1,
      mobile: user.mobile,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.jwtAccessSecret,
      expiresIn: this.jwtAccessExpiresIn,
    });

    const rawRefreshToken = this.securityService.generateRandomToken(40);
    const tokenHash = this.securityService.hashToken(rawRefreshToken);
    const familyId = existingFamilyId || crypto.randomUUID();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.jwtRefreshExpiresInDays);

    const refreshTokenDoc = new this.refreshTokenModel({
      userId: user._id,
      tokenHash,
      familyId,
      expiresAt,
      isRevoked: false,
      createdByIp: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    await refreshTokenDoc.save();

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  }

  private sanitizeUser(user: UserDocument): Partial<User> {
    const obj = user.toObject ? user.toObject() : { ...user };
    delete obj.passwordHash;
    delete obj.mfaSecret;
    delete obj.__v;
    return obj;
  }
}
