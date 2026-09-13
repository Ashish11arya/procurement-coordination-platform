export enum Permission {
  // Booking & Farmer self-service
  BOOKING_CREATE = 'booking:create',
  BOOKING_READ_SELF = 'booking:read:self',
  BOOKING_READ_CENTRE = 'booking:read:centre',
  BOOKING_READ_ALL = 'booking:read:all',
  BOOKING_CANCEL_SELF = 'booking:cancel:self',
  BOOKING_CANCEL_ADMIN = 'booking:cancel:admin',
  BOOKING_OVERRIDE = 'booking:override',

  // Counter operations (segregated per Section 5)
  CHECKIN_VERIFY = 'checkin:verify',
  CHECKIN_PERFORM = 'checkin:perform',
  WEIGHING_START = 'weighing:start',
  WEIGHING_RECORD = 'weighing:record',
  WEIGHING_VIEW = 'weighing:view',
  QUALITY_ASSESS = 'quality:assess',
  QUALITY_APPROVE = 'quality:approve',
  QUALITY_REJECT = 'quality:reject',
  QUALITY_VIEW = 'quality:view',
  PROCUREMENT_COMPLETE = 'procurement:complete',
  PROCUREMENT_SYNC = 'procurement:sync',
  PROCUREMENT_VIEW = 'procurement:view',

  // Centre & Counter administration
  CENTRE_VIEW = 'centre:view',
  CENTRE_MANAGE_CAPACITY = 'centre:manage:capacity',
  CENTRE_MANAGE_COUNTERS = 'centre:manage:counters',
  CENTRE_MANAGE_STAFF = 'centre:manage:staff',

  // Command-Centre Monitoring (Hierarchical)
  MONITORING_CENTRE = 'monitoring:centre',
  MONITORING_DISTRICT = 'monitoring:district',
  MONITORING_STATE = 'monitoring:state',
  MONITORING_NATIONAL = 'monitoring:national',

  // Audit and System Administration
  AUDIT_READ = 'audit:read',
  AUDIT_EXPORT = 'audit:export',
  USER_MANAGE_OPERATORS = 'user:manage:operators',
  SYSTEM_CONFIG = 'system:config',
  SYSTEM_HEALTH = 'system:health',
}
