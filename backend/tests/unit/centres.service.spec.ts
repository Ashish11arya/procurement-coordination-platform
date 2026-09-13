import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CentresService } from '../../src/modules/centres/centres.service';
import { Centre } from '../../src/modules/centres/schemas/centre.schema';
import { Counter, CounterStage, CounterStatus } from '../../src/modules/centres/schemas/counter.schema';
import { Commodity } from '../../src/modules/centres/schemas/commodity.schema';
import { GOVERNMENT_DATA_PROVIDER } from '../../src/modules/integrations/contracts/government-data-provider.interface';
import { MockGovernmentProvider } from '../../src/modules/integrations/providers/mock-government.provider';
import { createMockModel } from '../integration/in-memory-mongo.mock';

describe('CentresService (Unit Tests)', () => {
  let service: CentresService;
  let centreModel: any;
  let counterModel: any;
  let commodityModel: any;
  let govProvider: MockGovernmentProvider;

  beforeEach(async () => {
    centreModel = createMockModel();
    counterModel = createMockModel();
    commodityModel = createMockModel();
    govProvider = new MockGovernmentProvider();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CentresService,
        {
          provide: getModelToken(Centre.name),
          useValue: centreModel,
        },
        {
          provide: getModelToken(Counter.name),
          useValue: counterModel,
        },
        {
          provide: getModelToken(Commodity.name),
          useValue: commodityModel,
        },
        {
          provide: GOVERNMENT_DATA_PROVIDER,
          useValue: govProvider,
        },
      ],
    }).compile();

    service = module.get<CentresService>(CentresService);
  });

  describe('Centre Management', () => {
    it('should create a new centre successfully', async () => {
      const dto = {
        centreId: 'CENTRE-TEST-01',
        name: 'Test Procurement Centre',
        agencyName: 'NAFED',
        state: 'Madhya Pradesh',
        district: 'Indore',
        address: '123 Mandi Road',
        coordinates: { latitude: 22.7, longitude: 75.8 },
        operatingSeason: 'RABI_2026',
        supportedCommodities: ['WHEAT', 'CHANA'],
        dailyCapacityQuintals: 600,
        maxSimultaneousVehicles: 20,
      };

      const result = await service.createCentre(dto as any);
      expect(result).toBeDefined();
      expect(result.centreId).toBe('CENTRE-TEST-01');
      expect(result.dailyCapacityQuintals).toBe(600);
    });

    it('should reject creating duplicate centreId with ConflictException', async () => {
      const dto = {
        centreId: 'CENTRE-DUP-01',
        name: 'Centre One',
        agencyName: 'NAFED',
        state: 'Madhya Pradesh',
        district: 'Indore',
        address: 'Road A',
        coordinates: { latitude: 22.7, longitude: 75.8 },
        operatingSeason: 'RABI_2026',
        supportedCommodities: ['WHEAT'],
        dailyCapacityQuintals: 500,
      };

      await service.createCentre(dto as any);
      await expect(service.createCentre(dto as any)).rejects.toThrow(ConflictException);
    });

    it('should find existing centre by centreId', async () => {
      await service.createCentre({
        centreId: 'CENTRE-FIND-01',
        name: 'Findable Centre',
        agencyName: 'State Agency',
        state: 'Madhya Pradesh',
        district: 'Ujjain',
        address: 'Ujjain Bypass',
        coordinates: { latitude: 23.1, longitude: 75.7 },
        operatingSeason: 'RABI_2026',
        supportedCommodities: ['WHEAT'],
        dailyCapacityQuintals: 400,
      } as any);

      const found = await service.findByCentreId('CENTRE-FIND-01');
      expect(found).toBeDefined();
      expect(found.name).toBe('Findable Centre');
    });

    it('should bootstrap from GovernmentDataProvider if centre not in local DB', async () => {
      // CENTRE-MP-IND-01 exists in synthetic government provider
      const centre = await service.findByCentreId('CENTRE-MP-IND-01');
      expect(centre).toBeDefined();
      expect(centre.centreId).toBe('CENTRE-MP-IND-01');
      expect(centre.supportedCommodities).toContain('WHEAT');
    });

    it('should throw NotFoundException for unknown centreId', async () => {
      await expect(service.findByCentreId('CENTRE-NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Counter Operations (Multi-Counter Stage Model)', () => {
    beforeEach(async () => {
      await service.createCentre({
        centreId: 'CENTRE-CTR-TEST',
        name: 'Counter Test Centre',
        agencyName: 'NAFED',
        state: 'Madhya Pradesh',
        district: 'Indore',
        address: 'Test Address',
        coordinates: { latitude: 22.7, longitude: 75.8 },
        operatingSeason: 'RABI_2026',
        supportedCommodities: ['WHEAT'],
        dailyCapacityQuintals: 500,
      } as any);
    });

    it('should add operational counters across stages', async () => {
      const checkin = await service.addCounter('CENTRE-CTR-TEST', {
        counterId: 'CTR-IND-CK1',
        counterNumber: 1,
        stage: CounterStage.CHECKIN,
        capacityPerHourQuintals: 50,
      });

      const weighing = await service.addCounter('CENTRE-CTR-TEST', {
        counterId: 'CTR-IND-WT1',
        counterNumber: 1,
        stage: CounterStage.WEIGHING,
        capacityPerHourQuintals: 40,
      });

      expect(checkin.stage).toBe(CounterStage.CHECKIN);
      expect(weighing.stage).toBe(CounterStage.WEIGHING);

      const counters = await service.getCounters('CENTRE-CTR-TEST');
      expect(counters.length).toBe(2);
    });

    it('should update counter status to MAINTENANCE', async () => {
      await service.addCounter('CENTRE-CTR-TEST', {
        counterId: 'CTR-IND-MAINT',
        counterNumber: 2,
        stage: CounterStage.QUALITY,
        capacityPerHourQuintals: 30,
      });

      const updated = await service.updateCounter('CENTRE-CTR-TEST', 'CTR-IND-MAINT', {
        status: CounterStatus.MAINTENANCE,
      });

      expect(updated.status).toBe(CounterStatus.MAINTENANCE);
    });
  });

  describe('Capacity Tracking', () => {
    it('should calculate capacity, remaining volume and utilization percentage', async () => {
      await service.createCentre({
        centreId: 'CENTRE-CAP-TEST',
        name: 'Capacity Centre',
        agencyName: 'Civil Supplies',
        state: 'Madhya Pradesh',
        district: 'Indore',
        address: 'Mandi Yard',
        coordinates: { latitude: 22.9, longitude: 75.8 },
        operatingSeason: 'RABI_2026',
        supportedCommodities: ['WHEAT'],
        dailyCapacityQuintals: 500,
      } as any);

      // Total booked: 200 Quintals
      const capacityOverview = await service.getCentreCapacity(
        'CENTRE-CAP-TEST',
        '2026-09-20',
        200,
      );

      expect(capacityOverview.sanctionedDailyCapacityQuintals).toBe(500);
      expect(capacityOverview.totalBookedQuintals).toBe(200);
      expect(capacityOverview.remainingCapacityQuintals).toBe(300);
      expect(capacityOverview.utilizationPercentage).toBe(40.0);
      expect(capacityOverview.isOperational).toBe(true);
    });
  });
});
