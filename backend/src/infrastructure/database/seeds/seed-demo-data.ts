/**
 * Seed Demonstration Data for SIH Prototype (Section 42)
 * Creates a realistic procurement ecosystem:
 * - Sanwer Krishi Upaj Mandi (500Q daily capacity, 6 operational counters)
 * - 10 verified farmers across Indore district
 * - Multiple arrival windows & scheduled slots
 */

import { Types } from 'mongoose';

export const DEMO_CENTRE_ID = 'CENTRE-MP-IND-01';

export const DEMO_CENTRE = {
  _id: new Types.ObjectId(),
  centreId: DEMO_CENTRE_ID,
  name: 'Sanwer Krishi Upaj Mandi',
  state: 'Madhya Pradesh',
  district: 'Indore',
  subDistrict: 'Sanwer',
  address: 'Khandwa-Ujjain Highway, Sanwer, Madhya Pradesh 453551',
  location: {
    type: 'Point',
    coordinates: [75.8234, 22.9734],
  },
  dailyCapacityQuintals: 500,
  maxSimultaneousVehicles: 8,
  operatingHours: {
    openTime: '09:00',
    closeTime: '18:00',
  },
  supportedCommodities: ['WHEAT', 'MUSTARD', 'GRAM'],
  isActive: true,
};

export const DEMO_COUNTERS = [
  {
    counterId: 'CTR-CHK-01',
    centreId: DEMO_CENTRE_ID,
    name: 'Gate 1 Entry & Token Verification Counter',
    stage: 'CHECKIN',
    status: 'ACTIVE',
    capacityPerHourQuintals: 50,
    currentQueueLength: 0,
    supportedCommodities: ['WHEAT', 'MUSTARD', 'GRAM'],
  },
  {
    counterId: 'CTR-WEIGH-01',
    centreId: DEMO_CENTRE_ID,
    name: 'Electronic Weighbridge 1 (Heavy Vehicles)',
    stage: 'WEIGHING',
    status: 'ACTIVE',
    capacityPerHourQuintals: 30,
    currentQueueLength: 0,
    supportedCommodities: ['WHEAT', 'MUSTARD', 'GRAM'],
  },
  {
    counterId: 'CTR-WEIGH-02',
    centreId: DEMO_CENTRE_ID,
    name: 'Electronic Weighbridge 2 (Tractors / Small Trucks)',
    stage: 'WEIGHING',
    status: 'ACTIVE',
    capacityPerHourQuintals: 25,
    currentQueueLength: 0,
    supportedCommodities: ['WHEAT', 'MUSTARD', 'GRAM'],
  },
  {
    counterId: 'CTR-QUAL-01',
    centreId: DEMO_CENTRE_ID,
    name: 'Quality Testing & Grain Moisture Lab',
    stage: 'QUALITY',
    status: 'ACTIVE',
    capacityPerHourQuintals: 40,
    currentQueueLength: 0,
    supportedCommodities: ['WHEAT', 'MUSTARD', 'GRAM'],
  },
  {
    counterId: 'CTR-PROC-01',
    centreId: DEMO_CENTRE_ID,
    name: 'Final Procurement Desk & Digital Receipt Counter 1',
    stage: 'PROCUREMENT',
    status: 'ACTIVE',
    capacityPerHourQuintals: 35,
    currentQueueLength: 0,
    supportedCommodities: ['WHEAT', 'MUSTARD', 'GRAM'],
  },
  {
    counterId: 'CTR-PROC-02',
    centreId: DEMO_CENTRE_ID,
    name: 'Final Procurement Desk & Digital Receipt Counter 2',
    stage: 'PROCUREMENT',
    status: 'ACTIVE',
    capacityPerHourQuintals: 35,
    currentQueueLength: 0,
    supportedCommodities: ['WHEAT', 'MUSTARD', 'GRAM'],
  },
];

export const DEMO_FARMERS = [
  {
    farmerId: 'FARMER-MP-IND-001',
    name: 'Ramesh Kumar Verma',
    mobile: '9876543210',
    state: 'Madhya Pradesh',
    district: 'Indore',
    subDistrict: 'Sanwer',
    village: 'Dharampuri',
    landHoldingHectares: 4.5,
    verifiedCommodities: ['WHEAT', 'MUSTARD'],
    bankAccount: {
      accountNumberMasked: 'XXXXXX1234',
      ifscCode: 'SBIN0001234',
      bankName: 'State Bank of India',
      isVerified: true,
    },
    isActive: true,
  },
  {
    farmerId: 'FARMER-MP-IND-002',
    name: 'Suresh Patel',
    mobile: '9811223344',
    state: 'Madhya Pradesh',
    district: 'Indore',
    subDistrict: 'Sanwer',
    village: 'Kalyanpura',
    landHoldingHectares: 6.2,
    verifiedCommodities: ['WHEAT', 'GRAM'],
    bankAccount: {
      accountNumberMasked: 'XXXXXX5678',
      ifscCode: 'PUNB0005678',
      bankName: 'Punjab National Bank',
      isVerified: true,
    },
    isActive: true,
  },
  {
    farmerId: 'FARMER-MP-IND-003',
    name: 'Anil Choudhary',
    mobile: '9123456780',
    state: 'Madhya Pradesh',
    district: 'Indore',
    subDistrict: 'Depalpur',
    village: 'Ghatabillod',
    landHoldingHectares: 8.0,
    verifiedCommodities: ['WHEAT'],
    bankAccount: {
      accountNumberMasked: 'XXXXXX9012',
      ifscCode: 'BARB0009012',
      bankName: 'Bank of Baroda',
      isVerified: true,
    },
    isActive: true,
  },
  {
    farmerId: 'FARMER-MP-IND-004',
    name: 'Vikram Singh',
    mobile: '9822334455',
    state: 'Madhya Pradesh',
    district: 'Indore',
    subDistrict: 'Sanwer',
    village: 'Bhatkhedi',
    landHoldingHectares: 3.5,
    verifiedCommodities: ['WHEAT'],
    bankAccount: {
      accountNumberMasked: 'XXXXXX3456',
      ifscCode: 'SBIN0003456',
      bankName: 'State Bank of India',
      isVerified: true,
    },
    isActive: true,
  },
  {
    farmerId: 'FARMER-MP-IND-005',
    name: 'Mukesh Sharma',
    mobile: '9733445566',
    state: 'Madhya Pradesh',
    district: 'Indore',
    subDistrict: 'Sanwer',
    village: 'Ajnod',
    landHoldingHectares: 5.0,
    verifiedCommodities: ['WHEAT', 'MUSTARD'],
    bankAccount: {
      accountNumberMasked: 'XXXXXX7890',
      ifscCode: 'CNRB0007890',
      bankName: 'Canara Bank',
      isVerified: true,
    },
    isActive: true,
  },
];
