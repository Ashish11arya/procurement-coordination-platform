import { MockGovernmentProvider } from '../../src/modules/integrations/providers/mock-government.provider';

describe('MockGovernmentProvider (Unit Tests)', () => {
  let provider: MockGovernmentProvider;

  beforeEach(() => {
    provider = new MockGovernmentProvider();
  });

  describe('getFarmer', () => {
    it('should return synthetic farmer for known mobile number', async () => {
      const farmer = await provider.getFarmer('9876543210');
      expect(farmer).toBeDefined();
      expect(farmer?.name).toBe('Ramesh Kumar Verma');
      expect(farmer?.state).toBe('Madhya Pradesh');
      expect(farmer?.district).toBe('Indore');
      expect(farmer?.bankAccountVerified).toBe(true);
    });

    it('should return synthetic farmer by farmerId', async () => {
      const farmer = await provider.getFarmer('FARMER-MP-UJJ-002');
      expect(farmer).toBeDefined();
      expect(farmer?.name).toBe('Suresh Patel');
      expect(farmer?.mobile).toBe('9811223344');
    });

    it('should dynamically synthesize baseline record for valid 10-digit mobile', async () => {
      const farmer = await provider.getFarmer('9898989898');
      expect(farmer).toBeDefined();
      expect(farmer?.mobile).toBe('9898989898');
      expect(farmer?.farmerId).toContain('FARMER-SYNTH-9898');
    });

    it('should return null for invalid mobile format', async () => {
      const farmer = await provider.getFarmer('123');
      expect(farmer).toBeNull();
    });
  });

  describe('getFarmerEligibility', () => {
    it('should return eligibility with remaining quota and valid dates', async () => {
      const eligibility = await provider.getFarmerEligibility('FARMER-MP-IND-001', 'WHEAT');
      expect(eligibility.isEligible).toBe(true);
      expect(eligibility.commodityCode).toBe('WHEAT');
      expect(eligibility.sanctionedQuantityQuintals).toBe(100);
      expect(eligibility.remainingEligibleQuantityQuintals).toBe(85);
      expect(new Date(eligibility.validUntil).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('getCentres', () => {
    it('should return all synthetic centres without filters', async () => {
      const centres = await provider.getCentres();
      expect(centres.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter centres by district', async () => {
      const indoreCentres = await provider.getCentres({ district: 'Indore' });
      expect(indoreCentres.length).toBe(1);
      expect(indoreCentres[0].centreId).toBe('CENTRE-MP-IND-01');
    });

    it('should filter centres by commodity', async () => {
      const mustardCentres = await provider.getCentres({ commodityCode: 'MUSTARD' });
      expect(mustardCentres.length).toBe(1);
      expect(mustardCentres[0].supportedCommodities).toContain('MUSTARD');
    });
  });

  describe('getCentreCapacity', () => {
    it('should return realistic daily capacity constraints', async () => {
      const capacity = await provider.getCentreCapacity('CENTRE-MP-IND-01', '2026-04-10');
      expect(capacity.centreId).toBe('CENTRE-MP-IND-01');
      expect(capacity.sanctionedDailyCapacityQuintals).toBe(500);
      expect(capacity.availableCapacityQuintals).toBe(320);
      expect(capacity.maxSimultaneousVehicles).toBe(15);
    });
  });

  describe('submitProcurementUpdate', () => {
    it('should return official acknowledgement without error', async () => {
      const result = await provider.submitProcurementUpdate({
        externalBookingId: 'BOOK-TEST-001',
        farmerId: 'FARMER-MP-IND-001',
        centreId: 'CENTRE-MP-IND-01',
        commodityCode: 'WHEAT',
        netWeightQuintals: 50,
        moisturePercentage: 11.2,
        foreignMatterPercentage: 0.5,
        qualityGrade: 'GRADE_A',
        counterId: 'WEIGH-01',
        operatorUserId: 'OPERATOR-001',
        timestamp: new Date().toISOString(),
      });
      expect(result.success).toBe(true);
      expect(result.officialAcknowledgementId).toContain('GOV-ACK-');
      expect(result.statusCode).toBe('200_OK');
    });
  });

  describe('getPaymentStatus', () => {
    it('should return MSP-aligned payment record', async () => {
      const payment = await provider.getPaymentStatus('FARMER-MP-IND-001', 'PROC-101');
      expect(payment.farmerId).toBe('FARMER-MP-IND-001');
      expect(payment.amountRupees).toBeGreaterThan(0);
      expect(payment.utrNumber).toBeDefined();
      expect(payment.status).toBe('INITIATED');
    });
  });
});
