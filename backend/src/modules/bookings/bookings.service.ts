import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Booking,
  BookingDocument,
  BookingStatus,
  ArrivalWindowDetails,
} from './schemas/booking.schema';
import {
  BookingVehicle,
  BookingVehicleDocument,
  VehicleType,
  VehicleCheckInStatus,
} from './schemas/booking-vehicle.schema';
import {
  ArrivalWindow,
  ArrivalWindowDocument,
} from './schemas/arrival-window.schema';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { FarmersService } from '../farmers/farmers.service';
import { CentresService } from '../centres/centres.service';
import { IdempotencyService } from '../../infrastructure/security/idempotency.service';
import {
  GovernmentDataProvider,
  GOVERNMENT_DATA_PROVIDER,
} from '../integrations/contracts/government-data-provider.interface';

const ACTIVE_BOOKING_STATUSES = [
  BookingStatus.BOOKED,
  BookingStatus.CONFIRMED,
  BookingStatus.ARRIVED,
  BookingStatus.CHECKED_IN,
  BookingStatus.IN_PROGRESS,
  BookingStatus.COMPLETED,
];

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(BookingVehicle.name)
    private readonly vehicleModel: Model<BookingVehicleDocument>,
    @InjectModel(ArrivalWindow.name)
    private readonly windowModel: Model<ArrivalWindowDocument>,
    private readonly farmersService: FarmersService,
    private readonly centresService: CentresService,
    private readonly idempotencyService: IdempotencyService,
    @Inject(GOVERNMENT_DATA_PROVIDER)
    private readonly govProvider: GovernmentDataProvider,
  ) {}

  /**
   * 10-Step Booking Creation Flow per Section 6, Section 20, and Section 47
   */
  async createBooking(
    userId: string,
    dto: CreateBookingDto,
    idempotencyKey?: string,
  ): Promise<{
    success: boolean;
    message: string;
    booking: Booking;
    vehicles: BookingVehicle[];
    isIdempotentReplay?: boolean;
  }> {
    const endpoint = '/bookings';
    const requestHash = this.idempotencyService.hashPayload(dto);

    // 1. Check Idempotency Key (Section 20)
    if (idempotencyKey) {
      const check = await this.idempotencyService.checkKey(
        idempotencyKey,
        endpoint,
        userId,
        requestHash,
      );
      if (check.isDuplicate) {
        return {
          ...check.storedResponse,
          isIdempotentReplay: true,
        };
      }
    }

    // 2. Fetch Farmer Profile
    const farmer = await this.farmersService.getProfile(userId);
    const commodityCode = dto.commodityCode.toUpperCase();

    // 3. Authoritative Government Eligibility Validation (Section 3 & 4)
    const eligibility = await this.govProvider.getFarmerEligibility(
      farmer.farmerId,
      commodityCode,
    );
    if (!eligibility.isEligible) {
      throw new BadRequestException(
        `Farmer ${farmer.farmerId} is not officially eligible for ${commodityCode} procurement.`,
      );
    }
    if (dto.quantityQuintals > eligibility.remainingEligibleQuantityQuintals) {
      throw new BadRequestException(
        `Requested quantity (${dto.quantityQuintals}Q) exceeds remaining sanctioned quota (${eligibility.remainingEligibleQuantityQuintals}Q) for ${commodityCode}.`,
      );
    }

    // 4. Centre & Commodity Verification
    const centre = await this.centresService.findByCentreId(dto.centreId);
    if (!centre.isActive) {
      throw new BadRequestException(`Centre '${dto.centreId}' is currently inactive.`);
    }
    if (!centre.supportedCommodities.includes(commodityCode)) {
      throw new BadRequestException(
        `Centre '${dto.centreId}' does not support commodity '${commodityCode}'. Supported: ${centre.supportedCommodities.join(', ')}`,
      );
    }

    // 5. Vehicle Allocations Consistency Check (Section 12)
    const vehicleSum = dto.vehicles.reduce(
      (sum, v) => sum + Number(v.allocatedQuantityQuintals),
      0,
    );
    if (Math.abs(vehicleSum - dto.quantityQuintals) > 0.05) {
      throw new BadRequestException(
        `Total allocated vehicle quantity (${vehicleSum}Q) does not match requested booking quantity (${dto.quantityQuintals}Q).`,
      );
    }

    // 6. Capacity Tracking & Overbooking Prevention (Section 6 & 15)
    const existingBookings = await this.bookingModel
      .find({
        centreId: dto.centreId,
        bookingDate: dto.bookingDate,
        status: { $in: ACTIVE_BOOKING_STATUSES },
      })
      .exec();

    const currentDailyBooked = existingBookings.reduce(
      (sum, b) => sum + b.quantityQuintals,
      0,
    );

    const govCapacity = await this.govProvider.getCentreCapacity(
      dto.centreId,
      dto.bookingDate,
    );
    const dailySanctionedCapacity = Math.min(
      centre.dailyCapacityQuintals,
      govCapacity.sanctionedDailyCapacityQuintals,
    );

    if (currentDailyBooked + dto.quantityQuintals > dailySanctionedCapacity) {
      const remainingAvailable = Math.max(0, dailySanctionedCapacity - currentDailyBooked);
      throw new ConflictException(
        `Procurement centre daily capacity exceeded for date ${dto.bookingDate}. Sanctioned: ${dailySanctionedCapacity}Q, Already booked: ${currentDailyBooked}Q, Remaining: ${remainingAvailable}Q, Requested: ${dto.quantityQuintals}Q.`,
      );
    }

    // 7. Arrival Window Slot Allocation & Atomic Reservation
    const slotIndex = dto.preferredSlotIndex ?? 0;
    const startHour = 9 + (slotIndex % 8); // 09:00 to 17:00
    const endHour = startHour + 1;
    const startTime = `${String(startHour).padStart(2, '0')}:00`;
    const endTime = `${String(endHour).padStart(2, '0')}:00`;
    const slotMaxCapacity = Math.ceil(dailySanctionedCapacity / 8);

    // Find or initialize ArrivalWindow
    let window = await this.windowModel
      .findOne({
        centreId: dto.centreId,
        date: dto.bookingDate,
        slotIndex,
      })
      .exec();

    if (!window) {
      try {
        window = await this.windowModel.create({
          centreId: dto.centreId,
          date: dto.bookingDate,
          slotIndex,
          startTime,
          endTime,
          maxCapacityQuintals: slotMaxCapacity,
          bookedQuantityQuintals: 0,
          bookingCount: 0,
        });
      } catch (e: any) {
        // Handle concurrent insertion
        window = await this.windowModel
          .findOne({
            centreId: dto.centreId,
            date: dto.bookingDate,
            slotIndex,
          })
          .exec();
      }
    }

    // Atomic update of slot capacity
    const updatedWindow = await this.windowModel
      .findOneAndUpdate(
        {
          _id: window!._id,
          bookedQuantityQuintals: {
            $lte: slotMaxCapacity - dto.quantityQuintals,
          },
        },
        {
          $inc: {
            bookedQuantityQuintals: dto.quantityQuintals,
            bookingCount: 1,
          },
        },
        { new: true },
      )
      .exec();

    if (!updatedWindow) {
      throw new ConflictException(
        `Selected arrival window (${startTime} - ${endTime}) does not have sufficient capacity for ${dto.quantityQuintals}Q. Please select another slot.`,
      );
    }

    // 8. Generate Daily Sequential Token Number (Section 6)
    const dailySequence = existingBookings.length + 1;
    const tokenNumber = `T-${String(dailySequence).padStart(3, '0')}`;
    const cleanCentre = dto.centreId.replace(/[^A-Za-z0-9]/g, '');
    const cleanDate = dto.bookingDate.replace(/-/g, '');
    const bookingId = `BK-${cleanDate}-${cleanCentre.slice(-5)}-${String(dailySequence).padStart(4, '0')}`;

    const arrivalWindowDetails: ArrivalWindowDetails = {
      slotIndex,
      startTime,
      endTime,
    };

    // 9. Persist Booking and Vehicles (Section 12 & 15)
    const booking = new this.bookingModel({
      bookingId,
      tokenNumber,
      farmerId: farmer.farmerId,
      centreId: dto.centreId,
      commodityCode,
      quantityQuintals: dto.quantityQuintals,
      bookingDate: dto.bookingDate,
      arrivalWindow: arrivalWindowDetails,
      vehicleCount: dto.vehicles.length,
      status: BookingStatus.BOOKED,
      idempotencyKey: idempotencyKey || null,
    });
    await booking.save();

    const vehicleDocs = dto.vehicles.map((v) => ({
      bookingId,
      vehicleNumber: v.vehicleNumber.toUpperCase(),
      vehicleType: v.vehicleType || VehicleType.TRACTOR_TROLLEY,
      allocatedQuantityQuintals: v.allocatedQuantityQuintals,
      driverName: v.driverName || null,
      driverMobile: v.driverMobile || null,
      checkInStatus: VehicleCheckInStatus.PENDING,
    }));
    const createdVehicles = (await this.vehicleModel.insertMany(vehicleDocs)) as unknown as BookingVehicle[];

    const resultPayload = {
      success: true,
      message: `Procurement booking confirmed. Token: ${tokenNumber}`,
      booking,
      vehicles: createdVehicles,
    };

    // 10. Persist Idempotency Record (Section 20)
    if (idempotencyKey) {
      await this.idempotencyService.saveResponse(
        idempotencyKey,
        endpoint,
        userId,
        requestHash,
        201,
        resultPayload,
      );
    }

    this.logger.log(
      `Booking created: ${bookingId} (Token: ${tokenNumber}) for Farmer ${farmer.farmerId} at ${dto.centreId}`,
    );

    return resultPayload;
  }

  /**
   * List bookings for a farmer
   */
  async getFarmerBookings(farmerId: string): Promise<BookingDocument[]> {
    return this.bookingModel
      .find({ farmerId })
      .sort({ bookingDate: -1, createdAt: -1 })
      .exec();
  }

  /**
   * Get single booking with vehicles
   */
  async getBookingDetails(
    bookingId: string,
  ): Promise<{ booking: BookingDocument; vehicles: BookingVehicleDocument[] }> {
    const booking = await this.bookingModel.findOne({ bookingId }).exec();
    if (!booking) {
      throw new NotFoundException(`Booking '${bookingId}' not found.`);
    }
    const vehicles = await this.vehicleModel.find({ bookingId }).exec();
    return { booking, vehicles };
  }

  /**
   * List bookings for centre (operational view)
   */
  async findCentreBookings(
    centreId: string,
    date?: string,
    status?: BookingStatus,
  ): Promise<BookingDocument[]> {
    const query: any = { centreId };
    if (date) query.bookingDate = date;
    if (status) query.status = status;

    return this.bookingModel.find(query).sort({ tokenNumber: 1 }).exec();
  }

  /**
   * Cancel booking and release slot capacity
   */
  async cancelBooking(
    bookingId: string,
    farmerId: string,
    dto: CancelBookingDto,
  ): Promise<BookingDocument> {
    const booking = await this.bookingModel.findOne({ bookingId }).exec();
    if (!booking) {
      throw new NotFoundException(`Booking '${bookingId}' not found.`);
    }

    if (booking.farmerId !== farmerId) {
      throw new ForbiddenException('You can only cancel your own bookings.');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      return booking;
    }

    if (
      booking.status !== BookingStatus.BOOKED &&
      booking.status !== BookingStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        `Cannot cancel booking with status '${booking.status}'.`,
      );
    }

    booking.status = BookingStatus.CANCELLED;
    booking.cancellationReason = dto.reason;
    booking.cancelledAt = new Date();
    await booking.save();

    // Release capacity from ArrivalWindow
    await this.windowModel
      .findOneAndUpdate(
        {
          centreId: booking.centreId,
          date: booking.bookingDate,
          slotIndex: booking.arrivalWindow.slotIndex,
        },
        {
          $inc: {
            bookedQuantityQuintals: -booking.quantityQuintals,
            bookingCount: -1,
          },
        },
      )
      .exec();

    this.logger.log(`Booking ${bookingId} cancelled by farmer ${farmerId}. Reason: ${dto.reason}`);
    return booking;
  }
}
