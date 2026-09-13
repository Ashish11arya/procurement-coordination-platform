import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../../shared/enums/roles.enum';
import { ROLES_KEY } from '../../../shared/decorators/roles.decorator';
import { AuthenticatedUser } from '../../../shared/types/auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user }: { user: AuthenticatedUser } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Access denied: Authentication context missing.');
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied: Required role [${requiredRoles.join(', ')}], but current role is [${user.role}].`,
      );
    }

    return true;
  }
}
