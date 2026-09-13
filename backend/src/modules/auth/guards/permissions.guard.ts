import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '../../../shared/enums/permissions.enum';
import { PERMISSIONS_KEY } from '../../../shared/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../../shared/types/auth.types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user }: { user: AuthenticatedUser } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Access denied: Authentication context missing.');
    }

    const userPermissions = new Set(user.permissions || []);
    const hasAll = requiredPermissions.every((perm) => userPermissions.has(perm));

    if (!hasAll) {
      const missing = requiredPermissions.filter((perm) => !userPermissions.has(perm));
      throw new ForbiddenException(
        `Access denied: Missing required permission(s): [${missing.join(', ')}].`,
      );
    }

    return true;
  }
}
