import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { IntegrationsModule } from '../../src/modules/integrations/integrations.module';
import {
  GovernmentDataProvider,
  GOVERNMENT_DATA_PROVIDER,
  ProcurementUpdatePayload,
} from '../../src/modules/integrations/contracts/government-data-provider.interface';
import { MockGovernmentProvider } from '../../src/modules/integrations/providers/mock-government.provider';
import { ESamridhiProvider } from '../../src/modules/integrations/providers/esamridhi.provider';
import { ESamridhiNotYetAuthorizedException } from '../../src/modules/integrations/exceptions/not-yet-authorized.exception';

describe('ESamridhiProvider & Government Integration Abstraction Layer', () => {
  describe('1. Environment Feature Flag & Clean Provider Swapping', () => {
    const originalEnv = process.env.GOVERNMENT_PROVIDER;

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.GOVERNMENT_PROVIDER = originalEnv;
      } else {
        delete process.env.GOVERNMENT_PROVIDER;
      }
    });

    it('should inject MockGovernmentProvider when GOVERNMENT_PROVIDER=mock (default)', async () => {
      process.env.GOVERNMENT_PROVIDER = 'mock';
      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
          }),
          IntegrationsModule,
        ],
      }).compile();

      const provider = moduleRef.get<GovernmentDataProvider>(GOVERNMENT_DATA_PROVIDER);
      expect(provider).toBeDefined();
      expect(provider.providerName).toBe('MOCK_GOVERNMENT_PROVIDER');
      const mockInstance = moduleRef.get(MockGovernmentProvider);
      expect(mockInstance).toBeInstanceOf(MockGovernmentProvider);

      // Verify that mock data works normally under mock flag
      const farmer = await provider.getFarmer('9876543210');
      expect(farmer).toBeDefined();
      expect(farmer?.name).toBe('Ramesh Kumar Verma');
    });

    it('should inject ESamridhiProvider when GOVERNMENT_PROVIDER=esamridhi without other code changes', async () => {
      process.env.GOVERNMENT_PROVIDER = 'esamridhi';
      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
          }),
          IntegrationsModule,
        ],
      }).compile();

      const provider = moduleRef.get<GovernmentDataProvider>(GOVERNMENT_DATA_PROVIDER);
      expect(provider).toBeDefined();
      expect(provider.providerName).toBe('ESAMRIDHI_GOVERNMENT_PROVIDER');
      const esamridhiInstance = moduleRef.get(ESamridhiProvider);
      expect(esamridhiInstance).toBeInstanceOf(ESamridhiProvider);
    });
  });

  describe('2. Descriptive NotYetAuthorized Rejections Across All Contract Methods', () => {
    let esamridhiProvider: ESamridhiProvider;

    beforeEach(async () => {
      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [
              () => ({
                GOVERNMENT_PROVIDER: 'esamridhi',
                ESAMRIDHI_API_BASE_URL: 'https://api.esamridhi.gov.in/v1',
                // Explicitly no credentials to test protection against silent fake data
              }),
            ],
          }),
          IntegrationsModule,
        ],
      }).compile();

      esamridhiProvider = moduleRef.get<ESamridhiProvider>(ESamridhiProvider);
    });

    it('getFarmer(): should reject with ESamridhiNotYetAuthorizedException containing method and guidance', async () => {
      expect.assertions(4);
      try {
        await esamridhiProvider.getFarmer('9876543210');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ESamridhiNotYetAuthorizedException);
        expect(err.method).toBe('getFarmer');
        const response = err.getResponse();
        expect(response.error).toBe('GovernmentApiNotYetAuthorized');
        expect(response.guidance).toContain('GOVERNMENT_PROVIDER=mock');
      }
    });

    it('getFarmer(): should return null for malformed query before throwing', async () => {
      const result = await esamridhiProvider.getFarmer('12');
      expect(result).toBeNull();
    });

    it('getFarmerEligibility(): should reject with ESamridhiNotYetAuthorizedException and target commodity details', async () => {
      expect.assertions(4);
      try {
        await esamridhiProvider.getFarmerEligibility('FARMER-MP-IND-001', 'WHEAT');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ESamridhiNotYetAuthorizedException);
        expect(err.method).toBe('getFarmerEligibility');
        const response = err.getResponse();
        expect(response.commodityCode).toBe('WHEAT');
        expect(response.message).toContain('active NAFED API credentials');
      }
    });

    it('getCentres(): should reject with ESamridhiNotYetAuthorizedException', async () => {
      expect.assertions(3);
      try {
        await esamridhiProvider.getCentres({ district: 'Indore' });
      } catch (err: any) {
        expect(err).toBeInstanceOf(ESamridhiNotYetAuthorizedException);
        expect(err.method).toBe('getCentres');
        expect(err.getStatus()).toBe(503);
      }
    });

    it('getCentreCapacity(): should validate date format and reject with ESamridhiNotYetAuthorizedException', async () => {
      // Invalid date should fail standard validation
      await expect(
        esamridhiProvider.getCentreCapacity('CENTRE-MP-IND-01', 'invalid-date'),
      ).rejects.toThrow(/Expected YYYY-MM-DD/);

      // Valid date rejects with NotYetAuthorized
      expect.assertions(4);
      try {
        await esamridhiProvider.getCentreCapacity('CENTRE-MP-IND-01', '2026-04-15');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ESamridhiNotYetAuthorizedException);
        expect(err.method).toBe('getCentreCapacity');
        expect(err.getResponse().date).toBe('2026-04-15');
      }
    });

    it('getExistingBookings(): should reject with ESamridhiNotYetAuthorizedException', async () => {
      expect.assertions(2);
      try {
        await esamridhiProvider.getExistingBookings('CENTRE-MP-IND-01', '2026-04-15');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ESamridhiNotYetAuthorizedException);
        expect(err.method).toBe('getExistingBookings');
      }
    });

    it('getProcurementStatus(): should reject with ESamridhiNotYetAuthorizedException', async () => {
      expect.assertions(2);
      try {
        await esamridhiProvider.getProcurementStatus('BKG-20260415-IND01-0001');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ESamridhiNotYetAuthorizedException);
        expect(err.method).toBe('getProcurementStatus');
      }
    });

    it('submitProcurementUpdate(): should validate payload completeness and reject with ESamridhiNotYetAuthorizedException', async () => {
      // Incomplete payload throws error
      await expect(
        esamridhiProvider.submitProcurementUpdate({} as any),
      ).rejects.toThrow(/Incomplete procurement update payload/);

      const validPayload: ProcurementUpdatePayload = {
        externalBookingId: 'BKG-20260415-IND01-0001',
        farmerId: 'FARMER-MP-IND-001',
        centreId: 'CENTRE-MP-IND-01',
        commodityCode: 'WHEAT',
        netWeightQuintals: 45.5,
        moisturePercentage: 11.2,
        foreignMatterPercentage: 0.8,
        qualityGrade: 'GRADE_A',
        counterId: 'CTR-WEIGH-01',
        operatorUserId: 'user-op-01',
        timestamp: new Date().toISOString(),
      };

      expect.assertions(4);
      try {
        await esamridhiProvider.submitProcurementUpdate(validPayload);
      } catch (err: any) {
        expect(err).toBeInstanceOf(ESamridhiNotYetAuthorizedException);
        expect(err.method).toBe('submitProcurementUpdate');
        expect(err.getResponse().quantityQuintals).toBe(45.5);
      }
    });

    it('getPaymentStatus(): should reject with ESamridhiNotYetAuthorizedException', async () => {
      expect.assertions(2);
      try {
        await esamridhiProvider.getPaymentStatus('FARMER-MP-IND-001', 'REC-PROC-001');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ESamridhiNotYetAuthorizedException);
        expect(err.method).toBe('getPaymentStatus');
      }
    });

    it('syncStatus(): should return un-healthy status with diagnostic guidance when credentials missing', async () => {
      const syncResult = await esamridhiProvider.syncStatus('CENTRE-MP-IND-01');
      expect(syncResult).toBeDefined();
      expect(syncResult.centreId).toBe('CENTRE-MP-IND-01');
      expect(syncResult.isHealthy).toBe(false);
      expect(syncResult.lastError).toContain('Awaiting e-Samridhi gateway credentials');
    });
  });

  /**
   * 3. Production/Pilot Live Integration Suite (Ready for Day-One Sandbox Credentials)
   * Automatically activates when ESAMRIDHI_API_KEY is supplied in environment.
   */
  const liveTestsCondition = process.env.ESAMRIDHI_API_KEY ? describe : describe.skip;

  liveTestsCondition('3. Live Sandbox Integration Suite (e-Samridhi Pilot)', () => {
    let liveProvider: ESamridhiProvider;

    beforeAll(async () => {
      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
          }),
          IntegrationsModule,
        ],
      }).compile();

      liveProvider = moduleRef.get<ESamridhiProvider>(ESamridhiProvider);
    });

    it('[LIVE] should lookup registered farmer by mobile from official e-Samridhi registry', async () => {
      const farmer = await liveProvider.getFarmer('9876543210');
      expect(farmer).toBeDefined();
      expect(farmer?.state).toBeDefined();
      expect(farmer?.bankAccountVerified).toBe(true);
    });

    it('[LIVE] should query live PSS sowing ceiling and eligibility', async () => {
      const eligibility = await liveProvider.getFarmerEligibility(
        'FARMER-MP-IND-001',
        'WHEAT',
      );
      expect(eligibility.isEligible).toBe(true);
      expect(eligibility.sanctionedQuantityQuintals).toBeGreaterThan(0);
    });

    it('[LIVE] should fetch active PACS and Mandi centres list', async () => {
      const centres = await liveProvider.getCentres({ state: 'Madhya Pradesh' });
      expect(Array.isArray(centres)).toBe(true);
      expect(centres.length).toBeGreaterThan(0);
    });

    it('[LIVE] should query live daily intake capacity for mandi', async () => {
      const capacity = await liveProvider.getCentreCapacity(
        'CENTRE-MP-IND-01',
        new Date().toISOString().slice(0, 10),
      );
      expect(capacity.sanctionedDailyCapacityQuintals).toBeGreaterThan(0);
    });
  });
});
