import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import {
  DataProcessingLog,
  DataProcessingLogDocument,
  ProcessingPurpose,
  LawfulBasis,
  ProcessingAction,
} from '../schemas/data-processing-log.schema';
import { Role } from '../../../shared/enums/roles.enum';

export interface LogAccessParams {
  accessor: {
    userId: string;
    role: Role;
    name: string;
    ipAddress: string;
    userAgent?: string;
  };
  dataSubject: {
    farmerId: string;
    userId?: string;
    mobile?: string;
  };
  dataCategoriesAccessed: string[];
  processingPurpose: ProcessingPurpose;
  lawfulBasis?: LawfulBasis;
  action?: ProcessingAction;
  details?: string;
}

@Injectable()
export class DataProcessingLogService {
  private readonly logger = new Logger(DataProcessingLogService.name);

  constructor(
    @InjectModel(DataProcessingLog.name)
    private readonly logModel: Model<DataProcessingLogDocument>,
  ) {}

  /**
   * Records an immutable processing log entry whenever farmer PII is accessed or manipulated.
   */
  async logAccess(params: LogAccessParams): Promise<DataProcessingLogDocument> {
    try {
      const mobileMasked = params.dataSubject.mobile
        ? `${params.dataSubject.mobile.slice(0, 2)}******${params.dataSubject.mobile.slice(-2)}`
        : undefined;

      const entry = new this.logModel({
        logId: crypto.randomUUID(),
        accessor: params.accessor,
        dataSubject: {
          farmerId: params.dataSubject.farmerId,
          userId: params.dataSubject.userId,
          mobileMasked,
        },
        dataCategoriesAccessed: params.dataCategoriesAccessed,
        processingPurpose: params.processingPurpose,
        lawfulBasis: params.lawfulBasis || LawfulBasis.LEGITIMATE_USE_SEC_7B,
        action: params.action || ProcessingAction.READ,
        details: params.details,
        accessedAt: new Date(),
      });

      const saved = await entry.save();
      this.logger.debug(
        `[PII Processing Log] Purpose: ${params.processingPurpose} on Farmer: ${params.dataSubject.farmerId} by: ${params.accessor.userId} (${params.accessor.role})`,
      );
      return saved;
    } catch (err: any) {
      this.logger.error(`Failed to record data processing log: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Retrieves processing logs for a specific farmer (used during Data Subject Export).
   */
  async getLogsForFarmer(farmerId: string, limit = 100): Promise<DataProcessingLogDocument[]> {
    return this.logModel
      .find({ 'dataSubject.farmerId': farmerId })
      .sort({ accessedAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Retrieves all processing logs for regulatory audits (DPO / Government Admin).
   */
  async getAllLogs(limit = 100, skip = 0): Promise<{ count: number; logs: DataProcessingLogDocument[] }> {
    const [logs, count] = await Promise.all([
      this.logModel.find().sort({ accessedAt: -1 }).skip(skip).limit(limit).exec(),
      this.logModel.countDocuments().exec(),
    ]);
    return { count, logs };
  }
}
