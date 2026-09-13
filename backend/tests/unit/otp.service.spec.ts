import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { OtpService } from '../../src/modules/auth/services/otp.service';
import { RedisService } from '../../src/infrastructure/redis/redis.service';
import { SecurityService } from '../../src/infrastructure/security/security.service';
import { ConfigService } from '@nestjs/config';

describe('OtpService (Unit Tests)', () => {
  let otpService: OtpService;
  let redisService: jest.Mocked<RedisService>;
  let securityService: jest.Mocked<SecurityService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    redisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      incr: jest.fn(),
      ttl: jest.fn(),
    } as any;

    securityService = {
      generateOtp: jest.fn().mockReturnValue('123456'),
    } as any;

    configService = {
      get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'OTP_TTL_SECONDS') return 300;
        if (key === 'OTP_MAX_ATTEMPTS') return 3;
        if (key === 'OTP_THROTTLE_WINDOW_SECONDS') return 600;
        if (key === 'NODE_ENV') return 'development';
        return defaultVal;
      }),
    } as any;

    otpService = new OtpService(redisService, securityService, configService);
  });

  describe('requestOtp', () => {
    it('should generate 6-digit OTP, store in Redis and return mockOtp in dev', async () => {
      redisService.incr.mockResolvedValue(1); // 1st request

      const result = await otpService.requestOtp('9876543210');

      expect(result.mobile).toBe('9876543210');
      expect(result.expiresInSeconds).toBe(300);
      expect(result.mockOtp).toBe('123456');
      expect(redisService.set).toHaveBeenCalledWith('otp_code:9876543210', '123456', 300);
      expect(redisService.set).toHaveBeenCalledWith('otp_attempts:9876543210', '0', 300);
    });

    it('should throw TOO_MANY_REQUESTS when throttling threshold is exceeded', async () => {
      redisService.incr.mockResolvedValue(6); // 6th request in window

      await expect(otpService.requestOtp('9876543210')).rejects.toThrow(
        new HttpException(
          'Too many OTP requests. Please wait 10 minutes before requesting again.',
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );
    });
  });

  describe('verifyOtp', () => {
    it('should successfully verify valid OTP and delete keys to prevent replay', async () => {
      redisService.get.mockResolvedValue('123456');
      redisService.incr.mockResolvedValue(1);

      const isValid = await otpService.verifyOtp('9876543210', '123456');

      expect(isValid).toBe(true);
      expect(redisService.del).toHaveBeenCalledWith('otp_code:9876543210');
      expect(redisService.del).toHaveBeenCalledWith('otp_attempts:9876543210');
    });

    it('should throw BadRequestException when OTP has expired or was not requested', async () => {
      redisService.get.mockResolvedValue(null);

      await expect(otpService.verifyOtp('9876543210', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should decrement remaining attempts on invalid OTP', async () => {
      redisService.get.mockResolvedValue('123456');
      redisService.incr.mockResolvedValue(1); // 1st failed attempt

      await expect(otpService.verifyOtp('9876543210', '999999')).rejects.toThrow(
        'Invalid OTP. You have 2 attempts remaining.',
      );
    });

    it('should delete OTP and lock after exceeding max attempts', async () => {
      redisService.get.mockResolvedValue('123456');
      redisService.incr.mockResolvedValue(4); // Exceeds max 3

      await expect(otpService.verifyOtp('9876543210', '999999')).rejects.toThrow(
        'Maximum verification attempts exceeded. Please request a new OTP.',
      );
      expect(redisService.del).toHaveBeenCalledWith('otp_code:9876543210');
    });
  });
});
