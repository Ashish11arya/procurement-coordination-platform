/**
 * Shared Type Definitions matching Backend NestJS Contracts exactly
 */

export enum Role {
  FARMER = 'FARMER',
  CHECKIN_OPERATOR = 'CHECKIN_OPERATOR',
  WEIGHING_OPERATOR = 'WEIGHING_OPERATOR',
  QUALITY_OPERATOR = 'QUALITY_OPERATOR',
  PROCUREMENT_OPERATOR = 'PROCUREMENT_OPERATOR',
  CENTRE_ADMIN = 'CENTRE_ADMIN',
  DISTRICT_ADMIN = 'DISTRICT_ADMIN',
  STATE_ADMIN = 'STATE_ADMIN',
  GOVERNMENT_ADMIN = 'GOVERNMENT_ADMIN',
  AUDITOR = 'AUDITOR',
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
}

export enum QueueStatus {
  BOOKED = 'BOOKED',
  CONFIRMED = 'CONFIRMED',
  ARRIVED = 'ARRIVED',
  CHECKED_IN = 'CHECKED_IN',
  IN_YARD = 'IN_YARD',
  CALLED = 'CALLED',
  WAITING = 'WAITING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
  REJECTED = 'REJECTED',
  HELD = 'HELD',
}

export enum BookingStatus {
  DRAFT = 'DRAFT',
  PENDING_CONFIRMATION = 'PENDING_CONFIRMATION',
  BOOKED = 'BOOKED',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
  REJECTED = 'REJECTED',
}

export interface User {
  _id: string;
  userId?: string;
  name: string;
  role: Role;
  mobile?: string;
  email?: string;
  farmerId?: string;
  registrationNumber?: string;
  centreId?: string;
  state?: string;
  district?: string;
  subDistrict?: string;
  village?: string;
  landAreaAcres?: number;
}

export interface ArrivalWindow {
  startTime: string;
  endTime: string;
  slotIndex: number;
}

export interface BookingVehicle {
  vehicleNumber: string;
  vehicleType: string;
  driverName?: string;
  driverMobile?: string;
  allocatedQuantityQuintals: number;
}

export interface Booking {
  _id: string;
  bookingId: string;
  tokenNumber: string;
  farmerId: string;
  farmerName?: string;
  farmerMobile?: string;
  centreId: string;
  centreName?: string;
  commodityCode?: string;
  commodity?: string;
  quantityQuintals?: number;
  allocatedQuantityQuintals?: number;
  vehicleNumber?: string;
  vehicleType?: string;
  timeSlot?: string;
  queueStatus?: string;
  assignedCounterId?: string;
  bookingDate: string;
  arrivalWindow: ArrivalWindow;
  vehicles?: BookingVehicle[];
  vehicleCount: number;
  status: BookingStatus;
  cancellationReason?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Counter {
  _id?: string;
  counterId: string;
  centreId: string;
  counterNumber: number;
  stage: 'CHECKIN' | 'WEIGHING' | 'QUALITY' | 'PROCUREMENT';
  status: 'ACTIVE' | 'MAINTENANCE' | 'OFFLINE';
  capacityPerHourQuintals?: number;
  capacityPerHour?: number;
  currentQueueLength?: number;
  name?: string;
  type?: string;
}

export interface Centre {
  _id?: string;
  centreId: string;
  name: string;
  agencyName?: string;
  state: string;
  district: string;
  address: string;
  dailyCapacityQuintals: number;
  maxSimultaneousVehicles: number;
  operatingHours: { openTime: string; closeTime: string };
  supportedCommodities: string[];
  isActive: boolean;
}

export interface CentreDashboardData {
  centreId: string;
  centreName: string;
  district: string;
  state: string;
  date: string;
  sanctionedDailyCapacityQuintals: number;
  bookedQuantityQuintals: number;
  procuredQuantityQuintals: number;
  remainingCapacityQuintals: number;
  capacityUtilizationPercentage: number;
  totalBookingsCount: number;
  queueSummary: Record<string, number>;
  counters: Counter[];
  bottlenecks: {
    hasBottleneck: boolean;
    bottleneckStage: string;
    queueDepth: number;
  };
  alerts: number;
  isCached: boolean;
  metrics?: any;
  roster?: Booking[];
}

export interface TelemetryLog {
  id: string;
  timestamp: string;
  type: 'HTTP' | 'WS';
  method?: string;
  endpoint?: string;
  status?: number | string;
  durationMs?: string;
  success?: boolean;
  event?: string;
  channel?: string;
  payload?: any;
}
