import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Centre, CentreDocument } from './schemas/centre.schema';
import { Counter, CounterDocument } from './schemas/counter.schema';
import { Commodity, CommodityDocument } from './schemas/commodity.schema';
import { CreateCentreDto } from './dto/create-centre.dto';
import { UpdateCentreDto } from './dto/update-centre.dto';
import { CreateCounterDto } from './dto/create-counter.dto';
import { UpdateCounterDto } from './dto/update-counter.dto';
import { CreateCommodityDto } from './dto/create-commodity.dto';
import {
  GovernmentDataProvider,
  GOVERNMENT_DATA_PROVIDER,
} from '../integrations/contracts/government-data-provider.interface';

export interface CentreCapacityOverview {
  centreId: string;
  centreName: string;
  date: string;
  sanctionedDailyCapacityQuintals: number;
  totalBookedQuintals: number;
  remainingCapacityQuintals: number;
  utilizationPercentage: number;
  maxSimultaneousVehicles: number;
  operatingHours: { openTime: string; closeTime: string };
  isOperational: boolean;
}

@Injectable()
export class CentresService {
  private readonly logger = new Logger(CentresService.name);

  constructor(
    @InjectModel(Centre.name) private readonly centreModel: Model<CentreDocument>,
    @InjectModel(Counter.name) private readonly counterModel: Model<CounterDocument>,
    @InjectModel(Commodity.name) private readonly commodityModel: Model<CommodityDocument>,
    @Inject(GOVERNMENT_DATA_PROVIDER)
    private readonly govProvider: GovernmentDataProvider,
  ) {}

  // --------------------------------------------------------------------------
  // Centre Operations
  // --------------------------------------------------------------------------

  async createCentre(dto: CreateCentreDto): Promise<CentreDocument> {
    const existing = await this.centreModel.findOne({ centreId: dto.centreId }).exec();
    if (existing) {
      throw new ConflictException(`Centre with ID '${dto.centreId}' already exists.`);
    }

    const centre = new this.centreModel(dto);
    await centre.save();
    this.logger.log(`Created new procurement centre: ${centre.centreId} - ${centre.name}`);
    return centre;
  }

  async findAllCentres(filter?: {
    state?: string;
    district?: string;
    commodityCode?: string;
    isActive?: boolean;
  }): Promise<CentreDocument[]> {
    // If database is empty, seed from GovernmentDataProvider for initial bootstrapping
    const count = await this.centreModel.countDocuments().exec();
    if (count === 0) {
      await this.seedFromGovernmentProvider();
    }

    const query: any = {};
    if (filter?.state) query.state = new RegExp(filter.state, 'i');
    if (filter?.district) query.district = new RegExp(filter.district, 'i');
    if (filter?.commodityCode) query.supportedCommodities = filter.commodityCode.toUpperCase();
    if (filter?.isActive !== undefined) query.isActive = filter.isActive;

    return this.centreModel.find(query).exec();
  }

  async findByCentreId(centreId: string): Promise<CentreDocument> {
    let centre = await this.centreModel.findOne({ centreId }).exec();
    if (!centre) {
      // Check if government provider knows of this centre
      const govCentres = await this.govProvider.getCentres();
      const match = govCentres.find((c) => c.centreId === centreId);
      if (match) {
        centre = new this.centreModel({
          centreId: match.centreId,
          name: match.name,
          agencyName: match.agencyName,
          state: match.state,
          district: match.district,
          address: match.address,
          coordinates: { latitude: match.latitude, longitude: match.longitude },
          operatingSeason: match.operatingSeason,
          supportedCommodities: match.supportedCommodities,
          dailyCapacityQuintals: 500,
          maxSimultaneousVehicles: 15,
          operatingHours: { openTime: '09:00', closeTime: '18:00' },
          isActive: match.isActive,
        });
        await centre.save();
      } else {
        throw new NotFoundException(`Procurement centre '${centreId}' not found.`);
      }
    }
    return centre;
  }

  async updateCentre(centreId: string, dto: UpdateCentreDto): Promise<CentreDocument> {
    const centre = await this.findByCentreId(centreId);
    Object.assign(centre, dto);
    await centre.save();
    this.logger.log(`Updated procurement centre: ${centreId}`);
    return centre;
  }

  // --------------------------------------------------------------------------
  // Counter Operations
  // --------------------------------------------------------------------------

  async addCounter(centreId: string, dto: CreateCounterDto): Promise<CounterDocument> {
    await this.findByCentreId(centreId);

    const existing = await this.counterModel.findOne({ counterId: dto.counterId }).exec();
    if (existing) {
      throw new ConflictException(`Counter with ID '${dto.counterId}' already exists.`);
    }

    const counter = new this.counterModel({
      ...dto,
      centreId,
    });
    await counter.save();
    this.logger.log(`Added counter ${counter.counterId} (stage: ${counter.stage}) to centre ${centreId}`);
    return counter;
  }

  async getCounters(centreId: string): Promise<CounterDocument[]> {
    await this.findByCentreId(centreId);
    return this.counterModel.find({ centreId }).sort({ stage: 1, counterNumber: 1 }).exec();
  }

  async updateCounter(
    centreId: string,
    counterId: string,
    dto: UpdateCounterDto,
  ): Promise<CounterDocument> {
    const counter = await this.counterModel.findOne({ centreId, counterId }).exec();
    if (!counter) {
      throw new NotFoundException(`Counter '${counterId}' for centre '${centreId}' not found.`);
    }

    Object.assign(counter, dto);
    await counter.save();
    return counter;
  }

  // --------------------------------------------------------------------------
  // Commodity Operations
  // --------------------------------------------------------------------------

  async createCommodity(dto: CreateCommodityDto): Promise<CommodityDocument> {
    const code = dto.code.toUpperCase();
    const existing = await this.commodityModel.findOne({ code }).exec();
    if (existing) {
      throw new ConflictException(`Commodity '${code}' already registered.`);
    }

    const commodity = new this.commodityModel({
      ...dto,
      code,
    });
    await commodity.save();
    return commodity;
  }

  async findAllCommodities(): Promise<CommodityDocument[]> {
    const count = await this.commodityModel.countDocuments().exec();
    if (count === 0) {
      await this.seedDefaultCommodities();
    }
    return this.commodityModel.find({ isActive: true }).sort({ code: 1 }).exec();
  }

  // --------------------------------------------------------------------------
  // Capacity Tracking (Section 6 & 15)
  // --------------------------------------------------------------------------

  /**
   * Calculates real-time capacity overview for a centre on a given date.
   * Compares sanctioned physical ceiling (from GovernmentDataProvider)
   * against active booked volume.
   */
  async getCentreCapacity(
    centreId: string,
    date: string,
    bookedQuantityOverride?: number,
  ): Promise<CentreCapacityOverview> {
    const centre = await this.findByCentreId(centreId);

    // Fetch authoritative sanctioned capacity from GovernmentDataProvider
    const govCapacity = await this.govProvider.getCentreCapacity(centreId, date);
    const sanctionedCapacity = Math.min(
      centre.dailyCapacityQuintals,
      govCapacity.sanctionedDailyCapacityQuintals,
    );

    const totalBooked = bookedQuantityOverride ?? 0;
    const remaining = Math.max(0, sanctionedCapacity - totalBooked);
    const utilization = sanctionedCapacity > 0 ? (totalBooked / sanctionedCapacity) * 100 : 0;

    return {
      centreId: centre.centreId,
      centreName: centre.name,
      date,
      sanctionedDailyCapacityQuintals: sanctionedCapacity,
      totalBookedQuintals: totalBooked,
      remainingCapacityQuintals: remaining,
      utilizationPercentage: parseFloat(utilization.toFixed(2)),
      maxSimultaneousVehicles: centre.maxSimultaneousVehicles,
      operatingHours: centre.operatingHours,
      isOperational: centre.isActive && remaining > 0,
    };
  }

  // --------------------------------------------------------------------------
  // Internal Bootstrapping Helpers
  // --------------------------------------------------------------------------

  private async seedFromGovernmentProvider(): Promise<void> {
    const govCentres = await this.govProvider.getCentres();
    for (const gc of govCentres) {
      const exists = await this.centreModel.findOne({ centreId: gc.centreId }).exec();
      if (!exists) {
        await this.centreModel.create({
          centreId: gc.centreId,
          name: gc.name,
          agencyName: gc.agencyName,
          state: gc.state,
          district: gc.district,
          address: gc.address,
          coordinates: { latitude: gc.latitude, longitude: gc.longitude },
          operatingSeason: gc.operatingSeason,
          supportedCommodities: gc.supportedCommodities,
          dailyCapacityQuintals: 500,
          maxSimultaneousVehicles: 15,
          operatingHours: { openTime: '09:00', closeTime: '18:00' },
          isActive: gc.isActive,
        });

        // Seed default operational counters for each stage (Section 13)
        await this.counterModel.create([
          {
            counterId: `CTR-${gc.centreId}-CK1`,
            centreId: gc.centreId,
            counterNumber: 1,
            stage: 'CHECKIN',
            capacityPerHourQuintals: 50,
            status: 'ACTIVE',
          },
          {
            counterId: `CTR-${gc.centreId}-WT1`,
            centreId: gc.centreId,
            counterNumber: 1,
            stage: 'WEIGHING',
            capacityPerHourQuintals: 40,
            status: 'ACTIVE',
          },
          {
            counterId: `CTR-${gc.centreId}-QL1`,
            centreId: gc.centreId,
            counterNumber: 1,
            stage: 'QUALITY',
            capacityPerHourQuintals: 35,
            status: 'ACTIVE',
          },
          {
            counterId: `CTR-${gc.centreId}-PR1`,
            centreId: gc.centreId,
            counterNumber: 1,
            stage: 'PROCUREMENT',
            capacityPerHourQuintals: 50,
            status: 'ACTIVE',
          },
        ]);
      }
    }
  }

  private async seedDefaultCommodities(): Promise<void> {
    await this.commodityModel.create([
      {
        code: 'WHEAT',
        name: 'Wheat (FAQ Standard)',
        mspPerQuintal: 2275,
        season: 'RABI_2026',
        standardBagWeightKg: 50,
        isActive: true,
      },
      {
        code: 'CHANA',
        name: 'Gram / Chana',
        mspPerQuintal: 5440,
        season: 'RABI_2026',
        standardBagWeightKg: 50,
        isActive: true,
      },
      {
        code: 'MUSTARD',
        name: 'Mustard / Rapeseed',
        mspPerQuintal: 5650,
        season: 'RABI_2026',
        standardBagWeightKg: 50,
        isActive: true,
      },
    ]);
  }
}
