import { Role } from '../enums/roles.enum';
import { Permission } from '../enums/permissions.enum';

export interface ScopeContext {
  centreId?: string;
  districtId?: string;
  stateId?: string;
}

export interface AuthenticatedUser {
  userId: string;
  role: Role;
  permissions: Permission[];
  mobile?: string;
  email?: string;
  name?: string;
  scope: ScopeContext;
  tokenVersion: number;
}

export interface JwtPayload {
  sub: string;
  role: Role;
  permissions: Permission[];
  scope: ScopeContext;
  tokenVersion: number;
  mobile?: string;
  email?: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
