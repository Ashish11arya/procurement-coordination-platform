import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { BookingsService } from '../../src/modules/bookings/bookings.service';
import { Booking, BookingStatus } from '../../src/modules/bookings/schemas/booking.schema';
import { BookingVehicle, VehicleType } from '../../src/modules/bookings/schemas/booking-vehicle.schema';
import { ArrivalWindow } from '../../src/modules/bookings/schemas/arrival-window.schema';
import { FarmersService } from '../../src/modules/farmers/farmers.service';
import { CentresService } from '../../src/modules/centres/centres.service';
import { IdempotencyService } from '../../src/infrastructure/security/idempotency.service';
import { IdempotencyRecord } from '../../src/infrastructure/security/schemas/idempotency-record.schema';
import { GOVERNMENT_DATA_PROVIDER } from '../../src/modules/integrations/contracts/government-data-provider.interface';
import { MockGovernmentProvider } from '../../src/modules/integrations/providers/mock-government.provider';
import { createMockModel } from '../integration/in-memory-mongo.mock';

describe('BookingsService (Unit Tests)', () => {
  let service: BookingsService;
  let bookingModel: any;
  let vehicleModel: any;
  let windowModel: any;
  let idempotencyModel: any;
  let farmersService: any;
  let centresService: any;
  let idempotencyService: IdempotencyService;
  let govProvider: MockGovernmentProvider;

  const mockFarmer = {
    userId: 'user-farmer-1',
    farmerId: 'FARMER-MP-IND-001',
    name: 'Ramesh Kumar Verma',
    mobile: '9876543210',
    state: 'Madhya Pradesh',
    district: 'Indore',
    landAreaAcres: 5.5,
  };

  const mockCentre = {
    centreId: 'CENTRE-MP-IND-01',
    name: 'Sanwer Krishi Upaj Mandi',
    supportedCommodities: ['WHEAT', 'CHANA', 'MUSTARD'],
    dailyCapacityQuintals: 500,
    isActive: true,
    maxSimultaneousVehicles: 15,
  };

  beforeEach(async () => {
    bookingModel = createMockModel();
    vehicleModel = createMockModel();
    windowModel = createMockModel();
    idempotencyModel = createMockModel();
    govProvider = new MockGovernmentProvider();

    farmersService = {
      getProfile: jest.fn().mockResolvedValue(mockFarmer),
    };

    centresService = {
      findByCentreId: jest.fn().mockResolvedValue(mockCentre),
    };

    idempotencyService = new IdempotencyService(idempotencyModel);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: getModelToken(Booking.name),
          useValue: bookingModel,
        },
        {
          provide: getModelToken(BookingVehicle.name),
          useValue: vehicleModel,
        },
        {
          provide: getModelToken(ArrivalWindow.name),
          useValue: windowModel,
        },
        {
          provide: FarmersService,
          useValue: farmersService,
        },
        {
          provide: CentresService,
          useValue: centresService,
        },
        {
          provide: IdempotencyService,
          useValue: idempotencyService,
        },
        {
          provide: GOVERNMENT_DATA_PROVIDER,
          useValue: govProvider,
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  describe('Booking Creation Flow (Section 6 & 20)', () => {
    const validBookingDto = {
      centreId: 'CENTRE-MP-IND-01',
      commodityCode: 'WHEAT',
      quantityQuintals: 40,
      bookingDate: '2026-09-20',
      preferredSlotIndex: 1,
      vehicles: [
        {
          vehicleNumber: 'MP-09-AB-1234',
          vehicleType: VehicleType.TRACTOR_TROLLEY,
          allocatedQuantityQuintals: 40,
          driverName: 'Ramesh Verma',
        },
      ],
    };

    it('should create a booking with sequential token and vehicles', async () => {
      const result = await service.createBooking(
        'user-farmer-1',
        validBookingDto as any,
        'key-001',
      );

      expect(result.success).toBe(true);
      expect(result.booking).toBeDefined();
      expect(result.booking.tokenNumber).toBe('T-001');
      expect(result.booking.commodityCode).toBe('WHEAT');
      expect(result.booking.quantityQuintals).toBe(40);
      expect(result.vehicles.length).toBe(1);
      expect(result.vehicles[0].vehicleNumber).toBe('MP-09-AB-1234');
    });

    it('should enforce idempotency and replay cached response for same key and payload', async () => {
      // First call
      const first = await service.createBooking(
        'user-farmer-1',
        validBookingDto as any,
        'idempotency-key-test',
      );

      // Second call with same key
      const second = await service.createBooking(
        'user-farmer-1',
        validBookingDto as any,
        'idempotency-key-test',
      );

      expect(second.isIdempotentReplay).toBe(true);
      expect(second.booking.bookingId).toBe(first.booking.bookingId);
      expect(second.booking.tokenNumber).toBe(first.booking.tokenNumber);
    });

    it('should throw ConflictException if idempotency key is reused with different payload', async () => {
      await service.createBooking(
        'user-farmer-1',
        validBookingDto as any,
        'idempotency-collision-key',
      );

      const differentDto = {
        ...validBookingDto,
        quantityQuintals: 50,
      };

      await expect(
        service.createBooking(
          'user-farmer-1',
          differentDto as any,
          'idempotency-collision-key',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject booking if vehicle allocation sum does not match requested quantity', async () => {
      const invalidVehicleDto = {
        ...validBookingDto,
        quantityQuintals: 50,
        vehicles: [
          {
            vehicleNumber: 'MP-09-XY-9999',
            allocatedQuantityQuintals: 30, // 30 != 50
          },
        ],
      };

      await expect(
        service.createBooking('user-farmer-1', invalidVehicleDto as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject booking when quantity exceeds farmer remaining government quota', async () => {
      // Mock government provider says remaining quota is 85Q
      const excessiveDto = {
        ...validBookingDto,
        quantityQuintals: 95, // 95 > 85
        vehicles: [
          {
            vehicleNumber: 'MP-09-AB-1234',
            allocatedQuantityQuintals: 95,
          },
        ],
      };

      await expect(
        service.createBooking('user-farmer-1', excessiveDto as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject booking when quantity exceeds daily sanctioned centre capacity', async () => {
      // Gov provider sanctionedDailyCapacity is 500Q
      // Seed existing bookings up to 480Q
      await bookingModel.create({
        bookingId: 'BK-PREV-01',
        tokenNumber: 'T-001',
        centreId: 'CENTRE-MP-IND-01',
        farmerId: 'FARMER-OTHER',
        commodityCode: 'WHEAT',
        quantityQuintals: 480,
        bookingDate: '2026-09-20',
        status: BookingStatus.CONFIRMED,
      });

      // Try booking 40Q more (480 + 40 = 520 > 500)
      await expect(
        service.createBooking('user-farmer-1', validBookingDto as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should simulate two simultaneous requests racing for the last slot capacity and verify only one succeeds', async () => {
      // Setup window with capacity 63Q, pre-booked with 25Q -> 38Q remaining
      await windowModel.create({
        centreId: 'CENTRE-MP-IND-01',
        date: '2026-09-30',
        slotIndex: 3,
        startTime: '12:00',
        endTime: '13:00',
        maxCapacityQuintals: 63,
        bookedQuantityQuintals: 25,
        bookingCount: 1,
      });

      const bookingDtoA = {
        centreId: 'CENTRE-MP-IND-01',
        commodityCode: 'WHEAT',
        quantityQuintals: 30,
        bookingDate: '2026-09-30',
        preferredSlotIndex: 3,
        vehicles: [{ vehicleNumber: 'MP-09-AA-1111', allocatedQuantityQuintals: 30 }],
      };

      const bookingDtoB = {
        centreId: 'CENTRE-MP-IND-01',
        commodityCode: 'WHEAT',
        quantityQuintals: 30,
        bookingDate: '2026-09-30',
        preferredSlotIndex: 3,
        vehicles: [{ vehicleNumber: 'MP-09-BB-2222', allocatedQuantityQuintals: 30 }],
      };

      // Launch both requests simultaneously in parallel
      const [resA, resB] = await Promise.allSettled([
        service.createBooking('user-farmer-1', bookingDtoA as any),
        service.createBooking('user-farmer-1', bookingDtoB as any),
      ]);

      const fulfilled = [resA, resB].filter((r) => r.status === 'fulfilled');
      const rejected = [resA, resB].filter((r) => r.status === 'rejected');

      // Exactly ONE request succeeds
      expect(fulfilled).toHaveLength(1);
      // Exactly ONE request is rejected
      expect(rejected).toHaveLength(1);

      // Verify the rejected request failed with ConflictException on capacity
      const rejectionError = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectionError).toBeInstanceOf(ConflictException);
      expect(rejectionError.message).toContain('does not have sufficient capacity');

      // Verify the ArrivalWindow was atomically incremented to exactly 55Q (25 + 30), never 85Q
      const win = await windowModel.findOne({
        centreId: 'CENTRE-MP-IND-01',
        date: '2026-09-30',
        slotIndex: 3,
      }).exec();

      expect(win.bookedQuantityQuintals).toBe(55);
      expect(win.bookingCount).toBe(2);
    });
  });

  describe('Booking Cancellation', () => {
    it('should cancel booking and mark status as CANCELLED', async () => {
      const created = await service.createBooking(
        'user-farmer-1',
        {
          centreId: 'CENTRE-MP-IND-01',
          commodityCode: 'WHEAT',
          quantityQuintals: 25,
          bookingDate: '2026-09-22',
          preferredSlotIndex: 0,
          vehicles: [
            {
              vehicleNumber: 'MP-09-ZZ-0001',
              allocatedQuantityQuintals: 25,
            },
          ],
        } as any,
      );

      const cancelled = await service.cancelBooking(
        created.booking.bookingId,
        'FARMER-MP-IND-001',
        { reason: 'Tractor breakdown' },
      );

      expect(cancelled.status).toBe(BookingStatus.CANCELLED);
      expect(cancelled.cancellationReason).toBe('Tractor breakdown');
    });

    it('should prevent unauthorized farmer from cancelling another farmers booking', async () => {
      const created = await service.createBooking(
        'user-farmer-1',
        {
          centreId: 'CENTRE-MP-IND-01',
          commodityCode: 'WHEAT',
          quantityQuintals: 20,
          bookingDate: '2026-09-23',
          preferredSlotIndex: 0,
          vehicles: [
            {
              vehicleNumber: 'MP-09-ZZ-0002',
              allocatedQuantityQuintals: 20,
            },
          ],
        } as any,
      );

      await expect(
        service.cancelBooking(
          created.booking.bookingId,
          'FARMER-DIFFERENT',
          { reason: 'Fraudulent attempt' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
