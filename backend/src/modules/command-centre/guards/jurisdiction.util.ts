import { ForbiddenException } from '@nestjs/common';
import { Role } from '../../../shared/enums/roles.enum';
import { AuthenticatedUser } from '../../../shared/types/auth.types';

export interface JurisdictionalScope {
  state?: string;
  district?: string;
  centreId?: string;
}

export function enforceJurisdiction(
  user: AuthenticatedUser,
  requested: JurisdictionalScope,
): JurisdictionalScope {
  switch (user.role) {
    case Role.CENTRE_ADMIN:
      if (!user.scope?.centreId) {
        throw new ForbiddenException('User account missing assigned centreId scope.');
      }
      if (requested.centreId && requested.centreId !== user.scope.centreId) {
        throw new ForbiddenException(`Access denied to centre outside your assignment: ${user.scope.centreId}`);
      }
      return { centreId: user.scope.centreId };

    case Role.DISTRICT_ADMIN:
      if (!user.scope?.districtId) {
        throw new ForbiddenException('User account missing assigned districtId scope.');
      }
      if (requested.district && requested.district !== user.scope.districtId) {
        throw new ForbiddenException(`Access denied outside your assigned district: ${user.scope.districtId}`);
      }
      if (requested.state && user.scope.stateId && requested.state !== user.scope.stateId) {
        throw new ForbiddenException(`Access denied outside your assigned state: ${user.scope.stateId}`);
      }
      return {
        state: user.scope.stateId,
        district: user.scope.districtId,
        centreId: requested.centreId,
      };

    case Role.STATE_ADMIN:
      if (!user.scope?.stateId) {
        throw new ForbiddenException('User account missing assigned stateId scope.');
      }
      if (requested.state && requested.state !== user.scope.stateId) {
        throw new ForbiddenException(`Access denied outside your assigned state: ${user.scope.stateId}`);
      }
      return {
        state: user.scope.stateId,
        district: requested.district,
        centreId: requested.centreId,
      };

    case Role.GOVERNMENT_ADMIN:
    case Role.AUDITOR:
    case Role.SYSTEM_ADMIN:
      return {
        state: requested.state,
        district: requested.district,
        centreId: requested.centreId,
      };

    default:
      throw new ForbiddenException('Insufficient privileges for Command Centre operations.');
  }
}
