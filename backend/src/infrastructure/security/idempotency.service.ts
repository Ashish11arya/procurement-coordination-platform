import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import {
  IdempotencyRecord,
  IdempotencyRecordDocument,
} from './schemas/idempotency-record.schema';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectModel(IdempotencyRecord.name)
    private readonly idempotencyModel: Model<IdempotencyRecordDocument>,
  ) {}

  hashPayload(payload: any): string {
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  async checkKey(
    key: string,
    endpoint: string,
    userId: string,
    requestHash: string,
  ): Promise<{ isDuplicate: boolean; storedResponse?: any; statusCode?: number }> {
    if (!key) {
      return { isDuplicate: false };
    }

    const record = await this.idempotencyModel.findOne({ key }).exec();

    if (!record) {
      return { isDuplicate: false };
    }

    // Verify same user & request payload
    if (record.userId !== userId || record.requestHash !== requestHash) {
      this.logger.warn(`Idempotency key [${key}] used with differing payload or user.`);
      throw new ConflictException(
        'Idempotency key collision: The key was previously used with a different payload or user.',
      );
    }

    this.logger.log(`Idempotent request intercepted for key: ${key}. Returning cached response.`);
    return {
      isDuplicate: true,
      statusCode: record.statusCode,
      storedResponse: record.responseBody,
    };
  }

  async saveResponse(
    key: string,
    endpoint: string,
    userId: string,
    requestHash: string,
    statusCode: number,
    responseBody: any,
  ): Promise<void> {
    if (!key) return;

    try {
      await this.idempotencyModel.create({
        key,
        endpoint,
        userId,
        requestHash,
        statusCode,
        responseBody,
      });
    } catch (err: any) {
      // Key may have been concurrently created; non-critical
      this.logger.warn(`Failed to persist idempotency record for key: ${key} (${err.message})`);
    }
  }
}
