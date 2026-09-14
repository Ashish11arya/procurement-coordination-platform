import { DataProcessingLogService } from '../../src/modules/compliance/services/data-processing-log.service';
import { RetentionService } from '../../src/modules/compliance/services/retention.service';
import { ProcessingPurpose, LawfulBasis, ProcessingAction } from '../../src/modules/compliance/schemas/data-processing-log.schema';
import { Role } from '../../src/shared/enums/roles.enum';
import { BookingStatus } from '../../src/modules/bookings/schemas/booking.schema';

describe('DPDP Act 2023 Compliance & Retention Services (Unit Tests)', () => {
  describe('DataProcessingLogService', () => {
    let service: DataProcessingLogService;
    let mockLogModel: any;

    beforeEach(() => {
      mockLogModel = jest.fn().mockImplementation((doc) => ({
        ...doc,
        save: jest.fn().mockResolvedValue(doc),
      }));
      mockLogModel.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      mockLogModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(42),
      });

      service = new DataProcessingLogService(mockLogModel);
    });

    it('should log PII access event with masked mobile number and lawful purpose', async () => {
      const entry = await service.logAccess({
        accessor: {
          userId: 'user-op-01',
          role: Role.CHECKIN_OPERATOR,
          name: 'Gate In-Charge',
          ipAddress: '192.168.1.50',
          userAgent: 'Mozilla/5.0',
        },
        dataSubject: {
          farmerId: 'FARMER-MP-IND-001',
          userId: 'user-farmer-01',
          mobile: '9876543210',
        },
        dataCategoriesAccessed: ['NAME', 'MOBILE', 'LAND_RECORDS'],
        processingPurpose: ProcessingPurpose.GATE_CHECKIN_VERIFICATION,
        lawfulBasis: LawfulBasis.LEGITIMATE_USE_SEC_7B,
        action: ProcessingAction.READ,
      });

      expect(entry).toBeDefined();
      expect(entry.dataSubject.mobileMasked).toBe('98******10');
      expect(entry.dataCategoriesAccessed).toContain('NAME');
      expect(entry.dataCategoriesAccessed).toContain('MOBILE');
      expect(entry.processingPurpose).toBe(ProcessingPurpose.GATE_CHECKIN_VERIFICATION);
      expect(entry.lawfulBasis).toBe(LawfulBasis.LEGITIMATE_USE_SEC_7B);
    });

    it('should query logs for a specific farmer for data subject portability', async () => {
      const logs = await service.getLogsForFarmer('FARMER-MP-IND-001');
      expect(logs).toBeDefined();
      expect(mockLogModel.find).toHaveBeenCalledWith({ 'dataSubject.farmerId': 'FARMER-MP-IND-001' });
    });
  });

  describe('RetentionService (3-Tier Engine)', () => {
    let service: RetentionService;
    let mockBookingModel: any;
    let mockAuditModel: any;
    let mockProcessingLogModel: any;

    beforeEach(() => {
      mockBookingModel = {
        countDocuments: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(15),
        }),
        deleteMany: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ deletedCount: 15 }),
        }),
        find: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              { _id: '6aa79e5054f2eaad2d7f5901', farmerId: 'FARMER-01', save: jest.fn() },
            ]),
          }),
        }),
      };

      mockAuditModel = {
        countDocuments: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(2500),
        }),
      };

      mockProcessingLogModel = jest.fn().mockImplementation((doc) => ({
        ...doc,
        save: jest.fn().mockResolvedValue(doc),
      }));
      mockProcessingLogModel.countDocuments = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(120),
      });

      service = new RetentionService(mockBookingModel, mockAuditModel, mockProcessingLogModel);
    });

    afterEach(() => {
      service.onModuleDestroy();
    });

    it('should execute dry-run sweep without modifying database', async () => {
      const result = await service.executeRetentionPolicy(true);

      expect(result.dryRun).toBe(true);
      expect(result.tier1Operational.retentionDays).toBe(90);
      expect(result.tier1Operational.recordsPurged).toBe(0);
      expect(result.tier2Analytics.recordsAnonymized).toBe(0);
      expect(result.tier3StatutoryAudit.statutoryRetentionYears).toBe(7);
      expect(result.tier3StatutoryAudit.legalHoldEnforced).toBe(true);
      expect(mockBookingModel.deleteMany).not.toHaveBeenCalled();
    });

    it('should purge Tier 1 operational records and enforce Tier 3 statutory GFR hold in live run', async () => {
      const result = await service.executeRetentionPolicy(false);

      expect(result.dryRun).toBe(false);
      expect(result.tier1Operational.recordsPurged).toBe(15);
      expect(mockBookingModel.deleteMany).toHaveBeenCalled();
      expect(result.tier3StatutoryAudit.protectedAuditRecordsCount).toBe(2500);
      expect(result.tier3StatutoryAudit.legalReference).toContain('GFR');
    });

    it('should return health and status posture of all 3 retention tiers', async () => {
      const status = await service.getRetentionStatus();

      expect(status.status).toBe('HEALTHY');
      expect(status.tiers.tier1OperationalQueue.retentionDays).toBe(90);
      expect(status.tiers.tier2Analytics.retentionDays).toBe(180);
      expect(status.tiers.tier3StatutoryFinancialAudit.retentionYears).toBe(7);
      expect(status.tiers.tier3StatutoryFinancialAudit.legalHold).toContain('7-Year Mandatory Preservation');
    });
  });
});
