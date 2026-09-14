import {
  Injectable,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Centre, CentreDocument } from '../centres/schemas/centre.schema';
import { Counter, CounterDocument, CounterStatus } from '../centres/schemas/counter.schema';
import { Booking, BookingDocument, BookingStatus } from '../bookings/schemas/booking.schema';
import { QueueState, QueueStateDocument, QueueStatus } from '../queue/schemas/queue-state.schema';
import { ArrivalWindow, ArrivalWindowDocument } from '../bookings/schemas/arrival-window.schema';
import {
  ProcurementRecord,
  ProcurementRecordDocument,
  GovSyncStatus,
} from '../operations/schemas/procurement-record.schema';
import {
  GovernmentDataProvider,
  GOVERNMENT_DATA_PROVIDER,
} from '../integrations/contracts/government-data-provider.interface';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AuthenticatedUser } from '../../shared/types/auth.types';
import { Role } from '../../shared/enums/roles.enum';
import { CommandCentreFilterDto } from './dto/command-centre.dto';
import { enforceJurisdiction } from './guards/jurisdiction.util';

@Injectable()
export class CommandCentreService {
  private readonly logger = new Logger(CommandCentreService.name);

  constructor(
    @InjectModel(Centre.name)
    private readonly centreModel: Model<CentreDocument>,
    @InjectModel(Counter.name)
    private readonly counterModel: Model<CounterDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(QueueState.name)
    private readonly queueModel: Model<QueueStateDocument>,
    @InjectModel(ArrivalWindow.name)
    private readonly windowModel: Model<ArrivalWindowDocument>,
    @InjectModel(ProcurementRecord.name)
    private readonly procurementModel: Model<ProcurementRecordDocument>,
    @Inject(GOVERNMENT_DATA_PROVIDER)
    private readonly govProvider: GovernmentDataProvider,
    private readonly redisService: RedisService,
  ) {}

  // --------------------------------------------------------------------------
  // 1. State-Level Aggregation (Section 30)
  // --------------------------------------------------------------------------
  async getStatesSummary(user: AuthenticatedUser, query: CommandCentreFilterDto) {
    if (user.role === Role.DISTRICT_ADMIN || user.role === Role.CENTRE_ADMIN) {
      throw new ForbiddenException(
        'District and Centre administrators cannot view state-level aggregate dashboards.',
      );
    }

    const scope = enforceJurisdiction(user, query);
    const date = query.date || new Date().toISOString().split('T')[0];

    const centreFilter: any = { isActive: true };
    if (scope.state) {
      centreFilter.state = scope.state;
    }

    const centres = await this.centreModel.find(centreFilter).exec();
    const centreIds = centres.map((c) => c.centreId);

    const bookings = await this.bookingModel
      .find({
        centreId: { $in: centreIds },
        bookingDate: date,
      })
      .exec();

    // Group centres by state
    const statesMap = new Map<string, any>();

    for (const centre of centres) {
      if (!statesMap.has(centre.state)) {
        statesMap.set(centre.state, {
          state: centre.state,
          totalCentres: 0,
          sanctionedCapacityQuintals: 0,
          bookedQuantityQuintals: 0,
          procuredQuantityQuintals: 0,
          activeQueueCount: 0,
          totalBookingsCount: 0,
          districts: new Set<string>(),
          bottleneckCentresCount: 0,
        });
      }
      const st = statesMap.get(centre.state);
      st.totalCentres += 1;
      st.sanctionedCapacityQuintals += centre.dailyCapacityQuintals;
      st.districts.add(centre.district);
    }

    // Accumulate bookings into states
    const centreStateMap = new Map(centres.map((c) => [c.centreId, c.state]));
    for (const booking of bookings) {
      const stateName = centreStateMap.get(booking.centreId);
      if (!stateName || !statesMap.has(stateName)) continue;
      const st = statesMap.get(stateName);

      st.totalBookingsCount += 1;
      st.bookedQuantityQuintals += booking.quantityQuintals;

      if (booking.status === BookingStatus.COMPLETED) {
        st.procuredQuantityQuintals += booking.quantityQuintals;
      } else if (
        [
          BookingStatus.ARRIVED,
          BookingStatus.CHECKED_IN,
          BookingStatus.IN_PROGRESS,
        ].includes(booking.status)
      ) {
        st.activeQueueCount += 1;
      }
    }

    // Format output
    const results = Array.from(statesMap.values()).map((st) => ({
      state: st.state,
      totalDistricts: st.districts.size,
      totalCentres: st.totalCentres,
      sanctionedCapacityQuintals: st.sanctionedCapacityQuintals,
      bookedQuantityQuintals: st.bookedQuantityQuintals,
      procuredQuantityQuintals: st.procuredQuantityQuintals,
      remainingCapacityQuintals: Math.max(
        0,
        st.sanctionedCapacityQuintals - st.bookedQuantityQuintals,
      ),
      capacityUtilizationPercentage:
        st.sanctionedCapacityQuintals > 0
          ? Number(((st.bookedQuantityQuintals / st.sanctionedCapacityQuintals) * 100).toFixed(1))
          : 0,
      activeQueueCount: st.activeQueueCount,
      totalBookingsCount: st.totalBookingsCount,
    }));

    return {
      date,
      totalStates: results.length,
      states: results,
    };
  }

  // --------------------------------------------------------------------------
  // 2. District-Level Aggregation (Section 30)
  // --------------------------------------------------------------------------
  async getDistrictsSummary(user: AuthenticatedUser, query: CommandCentreFilterDto) {
    if (user.role === Role.CENTRE_ADMIN) {
      throw new ForbiddenException(
        'Centre administrators cannot view district aggregate dashboards.',
      );
    }

    const scope = enforceJurisdiction(user, query);
    const date = query.date || new Date().toISOString().split('T')[0];

    const centreFilter: any = { isActive: true };
    if (scope.state) centreFilter.state = scope.state;
    if (scope.district) centreFilter.district = scope.district;

    const centres = await this.centreModel.find(centreFilter).exec();
    const centreIds = centres.map((c) => c.centreId);

    const bookings = await this.bookingModel
      .find({
        centreId: { $in: centreIds },
        bookingDate: date,
      })
      .exec();

    // Group by state + district
    const districtsMap = new Map<string, any>();

    for (const centre of centres) {
      const key = `${centre.state}::${centre.district}`;
      if (!districtsMap.has(key)) {
        districtsMap.set(key, {
          state: centre.state,
          district: centre.district,
          totalCentres: 0,
          sanctionedCapacityQuintals: 0,
          bookedQuantityQuintals: 0,
          procuredQuantityQuintals: 0,
          activeQueueCount: 0,
          totalBookingsCount: 0,
        });
      }
      const dist = districtsMap.get(key);
      dist.totalCentres += 1;
      dist.sanctionedCapacityQuintals += centre.dailyCapacityQuintals;
    }

    const centreDistrictMap = new Map(centres.map((c) => [c.centreId, `${c.state}::${c.district}`]));
    for (const booking of bookings) {
      const key = centreDistrictMap.get(booking.centreId);
      if (!key || !districtsMap.has(key)) continue;
      const dist = districtsMap.get(key);

      dist.totalBookingsCount += 1;
      dist.bookedQuantityQuintals += booking.quantityQuintals;

      if (booking.status === BookingStatus.COMPLETED) {
        dist.procuredQuantityQuintals += booking.quantityQuintals;
      } else if (
        [
          BookingStatus.ARRIVED,
          BookingStatus.CHECKED_IN,
          BookingStatus.IN_PROGRESS,
        ].includes(booking.status)
      ) {
        dist.activeQueueCount += 1;
      }
    }

    const results = Array.from(districtsMap.values()).map((d) => ({
      state: d.state,
      district: d.district,
      totalCentres: d.totalCentres,
      sanctionedCapacityQuintals: d.sanctionedCapacityQuintals,
      bookedQuantityQuintals: d.bookedQuantityQuintals,
      procuredQuantityQuintals: d.procuredQuantityQuintals,
      remainingCapacityQuintals: Math.max(0, d.sanctionedCapacityQuintals - d.bookedQuantityQuintals),
      capacityUtilizationPercentage:
        d.sanctionedCapacityQuintals > 0
          ? Number(((d.bookedQuantityQuintals / d.sanctionedCapacityQuintals) * 100).toFixed(1))
          : 0,
      activeQueueCount: d.activeQueueCount,
      totalBookingsCount: d.totalBookingsCount,
    }));

    return {
      date,
      totalDistricts: results.length,
      districts: results,
    };
  }

  // --------------------------------------------------------------------------
  // 3. Centre-Level Aggregation & Drill-Down (Section 30)
  // --------------------------------------------------------------------------
  async getCentresSummary(user: AuthenticatedUser, query: CommandCentreFilterDto) {
    const scope = enforceJurisdiction(user, query);
    const date = query.date || new Date().toISOString().split('T')[0];

    const centreFilter: any = { isActive: true };
    if (scope.state) centreFilter.state = scope.state;
    if (scope.district) centreFilter.district = scope.district;
    if (scope.centreId) centreFilter.centreId = scope.centreId;

    const centres = await this.centreModel.find(centreFilter).exec();
    const centreIds = centres.map((c) => c.centreId);

    const bookings = await this.bookingModel
      .find({
        centreId: { $in: centreIds },
        bookingDate: date,
      })
      .exec();

    const counters = await this.counterModel.find({ centreId: { $in: centreIds } }).exec();

    const results = centres.map((centre) => {
      const cBookings = bookings.filter((b) => b.centreId === centre.centreId);
      const bookedQty = cBookings.reduce((sum, b) => sum + b.quantityQuintals, 0);
      const procuredQty = cBookings
        .filter((b) => b.status === BookingStatus.COMPLETED)
        .reduce((sum, b) => sum + b.quantityQuintals, 0);
      const activeQueue = cBookings.filter((b) =>
        [
          BookingStatus.ARRIVED,
          BookingStatus.CHECKED_IN,
          BookingStatus.IN_PROGRESS,
        ].includes(b.status),
      ).length;

      const cCounters = counters.filter((ctr) => ctr.centreId === centre.centreId);
      const activeCounters = cCounters.filter((ctr) => ctr.status === CounterStatus.ACTIVE).length;

      return {
        centreId: centre.centreId,
        name: centre.name,
        state: centre.state,
        district: centre.district,
        sanctionedCapacityQuintals: centre.dailyCapacityQuintals,
        bookedQuantityQuintals: bookedQty,
        procuredQuantityQuintals: procuredQty,
        remainingCapacityQuintals: Math.max(0, centre.dailyCapacityQuintals - bookedQty),
        capacityUtilizationPercentage:
          centre.dailyCapacityQuintals > 0
            ? Number(((bookedQty / centre.dailyCapacityQuintals) * 100).toFixed(1))
            : 0,
        activeQueueCount: activeQueue,
        totalBookingsCount: cBookings.length,
        countersSummary: {
          total: cCounters.length,
          active: activeCounters,
        },
      };
    });

    return {
      date,
      totalCentres: results.length,
      centres: results,
    };
  }

  // --------------------------------------------------------------------------
  // 4. Operational Bottleneck Detection (Section 29 & 30)
  // --------------------------------------------------------------------------
  async getBottlenecks(user: AuthenticatedUser, query: CommandCentreFilterDto) {
    const scope = enforceJurisdiction(user, query);
    const date = query.date || new Date().toISOString().split('T')[0];

    const centreFilter: any = { isActive: true };
    if (scope.state) centreFilter.state = scope.state;
    if (scope.district) centreFilter.district = scope.district;
    if (scope.centreId) centreFilter.centreId = scope.centreId;

    const centres = await this.centreModel.find(centreFilter).exec();
    const centreIds = centres.map((c) => c.centreId);

    const queues = await this.queueModel
      .find({
        centreId: { $in: centreIds },
        bookingDate: date,
      })
      .exec();

    const counters = await this.counterModel.find({ centreId: { $in: centreIds } }).exec();
    const windows = await this.windowModel.find({ centreId: { $in: centreIds }, date }).exec();

    const bottlenecks: any[] = [];

    for (const centre of centres) {
      const cQueues = queues.filter((q) => q.centreId === centre.centreId);
      const cCounters = counters.filter((c) => c.centreId === centre.centreId);
      const cWindows = windows.filter((w) => w.centreId === centre.centreId);

      const weighingQueue = cQueues.filter((q) =>
        q.currentStage === 'WEIGHING' && [QueueStatus.WAITING, QueueStatus.PROCESSING].includes(q.currentState),
      ).length;

      const qualityQueue = cQueues.filter((q) =>
        q.currentStage === 'QUALITY' && [QueueStatus.WAITING, QueueStatus.PROCESSING].includes(q.currentState),
      ).length;

      const offlineCounters = cCounters.filter((c) => c.status !== CounterStatus.ACTIVE);
      const capacityAlerts = cWindows.filter((w) => w.hasCapacityAlert).length;

      if (weighingQueue >= 3 || qualityQueue >= 3 || offlineCounters.length > 0 || capacityAlerts > 0) {
        let bottleneckStage = 'NONE';
        let severity = 'LOW';

        if (weighingQueue >= 5 || qualityQueue >= 5 || offlineCounters.length >= 2) {
          severity = 'HIGH';
        } else if (weighingQueue >= 3 || qualityQueue >= 3 || offlineCounters.length >= 1) {
          severity = 'MEDIUM';
        }

        if (weighingQueue >= qualityQueue && weighingQueue >= 3) {
          bottleneckStage = 'WEIGHING';
        } else if (qualityQueue >= 3) {
          bottleneckStage = 'QUALITY';
        } else if (offlineCounters.length > 0) {
          bottleneckStage = offlineCounters[0].stage;
        }

        bottlenecks.push({
          centreId: centre.centreId,
          centreName: centre.name,
          state: centre.state,
          district: centre.district,
          severity,
          bottleneckStage,
          weighingQueueDepth: weighingQueue,
          qualityQueueDepth: qualityQueue,
          offlineCountersCount: offlineCounters.length,
          capacityAlertsCount: capacityAlerts,
          recommendedAction:
            offlineCounters.length > 0
              ? `Re-activate ${offlineCounters.length} offline counter(s) or adjust intake window capacity.`
              : `Deploy auxiliary staff to ${bottleneckStage} stage to relieve queue depth (${Math.max(weighingQueue, qualityQueue)} vehicles).`,
        });
      }
    }

    return {
      date,
      totalBottlenecksDetected: bottlenecks.length,
      bottlenecks,
    };
  }

  // --------------------------------------------------------------------------
  // 5. Integration Health Monitoring (Section 30)
  // --------------------------------------------------------------------------
  async getIntegrationHealth(user: AuthenticatedUser) {
    if (
      ![Role.GOVERNMENT_ADMIN, Role.AUDITOR, Role.SYSTEM_ADMIN].includes(user.role)
    ) {
      throw new ForbiddenException(
        'Integration health monitoring is restricted to Government Admins, Auditors, and System Admins.',
      );
    }

    const totalRecords = await this.procurementModel.countDocuments().exec();
    const syncedRecords = await this.procurementModel
      .countDocuments({ govSyncStatus: GovSyncStatus.SYNCED })
      .exec();
    const failedRecords = await this.procurementModel
      .countDocuments({ govSyncStatus: GovSyncStatus.FAILED })
      .exec();
    const pendingRecords = await this.procurementModel
      .countDocuments({ govSyncStatus: GovSyncStatus.PENDING })
      .exec();

    // Query GovernmentProvider via Circuit Breaker
    let govStatus: any;
    try {
      govStatus = await this.govProvider.syncStatus('ALL_CENTRES');
    } catch (err: any) {
      govStatus = {
        isHealthy: false,
        lastError: err.message,
        lastSyncTimestamp: new Date().toISOString(),
      };
    }

    const circuitBreaker = (this.govProvider as any)?.getCircuitBreakerMetrics?.() || null;

    // Determine overall health status
    let healthStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN' = 'HEALTHY';
    if (circuitBreaker?.state === 'OPEN' || !govStatus.isHealthy) {
      healthStatus = 'DEGRADED';
    } else if (failedRecords > 0 && totalRecords > 0 && failedRecords / totalRecords >= 0.05) {
      healthStatus = 'DEGRADED';
    } else if (failedRecords > 0) {
      healthStatus = 'DEGRADED';
    }

    return {
      status: healthStatus,
      provider: this.govProvider.providerName,
      isProviderConnected: govStatus.isHealthy && circuitBreaker?.state !== 'OPEN',
      totalSyncAttempts: totalRecords,
      successfulSyncCount: syncedRecords,
      failedSyncCount: failedRecords,
      pendingSyncCount: pendingRecords,
      failureRatePercentage:
        totalRecords > 0 ? Number(((failedRecords / totalRecords) * 100).toFixed(1)) : 0,
      lastSyncTimestamp: govStatus.lastSyncTimestamp,
      lastError: govStatus.lastError || circuitBreaker?.lastTripReason,
      circuitBreaker: circuitBreaker || { state: 'CLOSED' },
      activeMode: this.govProvider.providerName === 'ESAMRIDHI_GOVERNMENT_PROVIDER' ? 'PRODUCTION_ESAMRIDHI' : 'DEVELOPMENT_MOCK',
    };
  }
}
