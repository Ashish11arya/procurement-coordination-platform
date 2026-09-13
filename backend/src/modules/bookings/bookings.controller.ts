import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { FarmersService } from '../farmers/farmers.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { BookingFilterDto } from './dto/booking-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Role } from '../../shared/enums/roles.enum';
import { AuthenticatedUser } from '../../shared/types/auth.types';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly farmersService: FarmersService,
  ) {}

  @Post()
  @Roles(Role.FARMER)
  async createBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookingDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.bookingsService.createBooking(user.userId, dto, idempotencyKey);
  }

  @Get()
  async listBookings(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: BookingFilterDto,
  ) {
    if (user.role === Role.FARMER) {
      const farmer = await this.farmersService.getProfile(user.userId);
      const bookings = await this.bookingsService.getFarmerBookings(farmer.farmerId);
      return {
        success: true,
        count: bookings.length,
        bookings,
      };
    }

    // Centre operators / Administrators view
    if (!filter.centreId) {
      throw new ForbiddenException(
        "Non-farmer users must supply query parameter 'centreId' to view centre bookings.",
      );
    }

    const bookings = await this.bookingsService.findCentreBookings(
      filter.centreId,
      filter.date,
      filter.status,
    );
    return {
      success: true,
      count: bookings.length,
      bookings,
    };
  }

  @Get(':bookingId')
  async getBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId') bookingId: string,
  ) {
    const details = await this.bookingsService.getBookingDetails(bookingId);

    // If caller is a farmer, enforce ownership
    if (user.role === Role.FARMER) {
      const farmer = await this.farmersService.getProfile(user.userId);
      if (details.booking.farmerId !== farmer.farmerId) {
        throw new ForbiddenException('You can only view your own bookings.');
      }
    }

    return {
      success: true,
      ...details,
    };
  }

  @Patch(':bookingId/cancel')
  @Roles(Role.FARMER)
  async cancelBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId') bookingId: string,
    @Body() dto: CancelBookingDto,
  ) {
    const farmer = await this.farmersService.getProfile(user.userId);
    const updated = await this.bookingsService.cancelBooking(
      bookingId,
      farmer.farmerId,
      dto,
    );
    return {
      success: true,
      message: 'Booking cancelled successfully',
      booking: updated,
    };
  }
}
