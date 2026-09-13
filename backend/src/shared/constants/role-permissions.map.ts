import { Role } from '../enums/roles.enum';
import { Permission } from '../enums/permissions.enum';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.FARMER]: [
    Permission.BOOKING_CREATE,
    Permission.BOOKING_READ_SELF,
    Permission.BOOKING_CANCEL_SELF,
    Permission.CENTRE_VIEW,
  ],
  [Role.CHECKIN_OPERATOR]: [
    Permission.CHECKIN_VERIFY,
    Permission.CHECKIN_PERFORM,
    Permission.BOOKING_READ_CENTRE,
    Permission.CENTRE_VIEW,
  ],
  [Role.WEIGHING_OPERATOR]: [
    Permission.WEIGHING_START,
    Permission.WEIGHING_RECORD,
    Permission.WEIGHING_VIEW,
    Permission.BOOKING_READ_CENTRE,
    Permission.CENTRE_VIEW,
  ],
  [Role.QUALITY_OPERATOR]: [
    Permission.QUALITY_ASSESS,
    Permission.QUALITY_APPROVE,
    Permission.QUALITY_REJECT,
    Permission.QUALITY_VIEW,
    Permission.BOOKING_READ_CENTRE,
    Permission.CENTRE_VIEW,
  ],
  [Role.PROCUREMENT_OPERATOR]: [
    Permission.PROCUREMENT_COMPLETE,
    Permission.PROCUREMENT_SYNC,
    Permission.PROCUREMENT_VIEW,
    Permission.BOOKING_READ_CENTRE,
    Permission.CENTRE_VIEW,
  ],
  [Role.CENTRE_ADMIN]: [
    Permission.BOOKING_READ_CENTRE,
    Permission.BOOKING_CANCEL_ADMIN,
    Permission.BOOKING_OVERRIDE,
    Permission.CENTRE_VIEW,
    Permission.CENTRE_MANAGE_CAPACITY,
    Permission.CENTRE_MANAGE_COUNTERS,
    Permission.CENTRE_MANAGE_STAFF,
    Permission.MONITORING_CENTRE,
  ],
  [Role.DISTRICT_ADMIN]: [
    Permission.BOOKING_READ_ALL,
    Permission.CENTRE_VIEW,
    Permission.MONITORING_CENTRE,
    Permission.MONITORING_DISTRICT,
  ],
  [Role.STATE_ADMIN]: [
    Permission.BOOKING_READ_ALL,
    Permission.CENTRE_VIEW,
    Permission.MONITORING_CENTRE,
    Permission.MONITORING_DISTRICT,
    Permission.MONITORING_STATE,
  ],
  [Role.GOVERNMENT_ADMIN]: [
    Permission.BOOKING_READ_ALL,
    Permission.CENTRE_VIEW,
    Permission.MONITORING_CENTRE,
    Permission.MONITORING_DISTRICT,
    Permission.MONITORING_STATE,
    Permission.MONITORING_NATIONAL,
    Permission.AUDIT_READ,
  ],
  [Role.AUDITOR]: [
    Permission.AUDIT_READ,
    Permission.AUDIT_EXPORT,
    Permission.BOOKING_READ_ALL,
    Permission.CENTRE_VIEW,
    Permission.MONITORING_NATIONAL,
  ],
  [Role.SYSTEM_ADMIN]: Object.values(Permission),
};
