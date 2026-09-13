import { Injectable, BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { SecurityService } from '../../../infrastructure/security/security.service';

export interface OtpGenerationResult {
  mobile: string;
  expiresInSeconds: number;
  // Included in mock mode for testing/demo environments
  mockOtp?: string;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly ttlSeconds: number;
  private readonly maxAttempts: number;
  private readonly throttleWindowSeconds: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly securityService: SecurityService,
    private readonly configService: ConfigService,
  ) {
    this.ttlSeconds = Number(this.configService.get<number>('OTP_TTL_SECONDS', 300));
    this.maxAttempts = Number(this.configService.get<number>('OTP_MAX_ATTEMPTS', 3));
    this.throttleWindowSeconds = Number(this.configService.get<number>('OTP_THROTTLE_WINDOW_SECONDS', 600));
  }

  /**
   * Request OTP generation with rate limiting and throttling
   */
  async requestOtp(mobile: string): Promise<OtpGenerationResult> {
    const throttleKey = `otp_throttle:${mobile}`;
    const requestCount = await this.redisService.incr(throttleKey, this.throttleWindowSeconds);

    if (requestCount > 5) {
      this.logger.warn(`OTP rate limit exceeded for mobile: ${mobile}`);
      throw new HttpException(
        'Too many OTP requests. Please wait 10 minutes before requesting again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Generate 6-digit OTP
    const otp = this.securityService.generateOtp(6);
    const otpKey = `otp_code:${mobile}`;
    const attemptsKey = `otp_attempts:${mobile}`;

    // Store OTP in Redis/Memory with TTL
    await this.redisService.set(otpKey, otp, this.ttlSeconds);
    // Reset attempt counter
    await this.redisService.set(attemptsKey, '0', this.ttlSeconds);

    // [MOCK OTP PROVIDER PER SPEC SECTION 3 & 47]
    this.logger.log(`=======================================================`);
    this.logger.log(`[MOCK_OTP_PROVIDER] SMS dispatched to mobile: +91-${mobile}`);
    this.logger.log(`[MOCK_OTP_PROVIDER] Generated OTP Code: ${otp} (Valid for ${this.ttlSeconds}s)`);
    this.logger.log(`=======================================================`);

    return {
      mobile,
      expiresInSeconds: this.ttlSeconds,
      // Expose in response only when not in strict production mode for automated testing/UI ease
      mockOtp: this.configService.get<string>('NODE_ENV') !== 'production' ? otp : undefined,
    };
  }

  /**
   * Verify provided OTP with attempt limits
   */
  async verifyOtp(mobile: string, userOtp: string): Promise<boolean> {
    const otpKey = `otp_code:${mobile}`;
    const attemptsKey = `otp_attempts:${mobile}`;

    const storedOtp = await this.redisService.get(otpKey);
    if (!storedOtp) {
      throw new BadRequestException('OTP has expired or was never requested. Please request a new OTP.');
    }

    const currentAttempts = await this.redisService.incr(attemptsKey);
    if (currentAttempts > this.maxAttempts) {
      await this.redisService.del(otpKey);
      await this.redisService.del(attemptsKey);
      this.logger.warn(`Max OTP verification attempts exceeded for mobile: ${mobile}`);
      throw new BadRequestException('Maximum verification attempts exceeded. Please request a new OTP.');
    }

    if (storedOtp.trim() !== userOtp.trim()) {
      const remaining = this.maxAttempts - currentAttempts;
      throw new BadRequestException(
        `Invalid OTP. You have ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`,
      );
    }

    // Success - consume and delete the OTP immediately to prevent replay attacks
    await this.redisService.del(otpKey);
    await this.redisService.del(attemptsKey);
    return true;
  }
}
