import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from '../../../shared/enums/roles.enum';
import { Permission } from '../../../shared/enums/permissions.enum';
import { ScopeContext } from '../../../shared/types/auth.types';

export type UserDocument = User & Document;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ unique: true, sparse: true, index: true })
  mobile?: string; // For FARMER role

  @Prop({ unique: true, sparse: true, index: true, lowercase: true, trim: true })
  email?: string; // For Operator / Admin roles

  @Prop({ unique: true, sparse: true, trim: true })
  username?: string; // For Operator / Admin roles

  @Prop({ required: true })
  name: string;

  @Prop({ select: false })
  passwordHash?: string; // Never returned in queries by default

  @Prop({ required: true, enum: Role, default: Role.FARMER, index: true })
  role: Role;

  @Prop({ type: [String], enum: Permission, default: [] })
  customPermissions: Permission[];

  @Prop({
    type: {
      centreId: { type: String, index: true },
      districtId: { type: String, index: true },
      stateId: { type: String, index: true },
    },
    default: {},
  })
  scope: ScopeContext;

  // MFA-ready fields per spec
  @Prop({ default: false })
  isMfaEnabled: boolean;

  @Prop({ select: false })
  mfaSecret?: string;

  // Token invalidation counter
  @Prop({ default: 1 })
  tokenVersion: number;

  // Account security / lock
  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  failedLoginAttempts: number;

  @Prop()
  lockedUntil?: Date;

  // Farmer specific metadata
  @Prop()
  farmerId?: string;

  @Prop()
  registrationNumber?: string;

  @Prop()
  state?: string;

  @Prop()
  district?: string;

  @Prop()
  subDistrict?: string;

  @Prop()
  village?: string;

  @Prop()
  landAreaAcres?: number;

  @Prop()
  lastLoginAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ role: 1, isActive: 1 });
