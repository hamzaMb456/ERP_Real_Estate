import type { Op } from '../registry.ts';
import { calendarOps } from './calendar.ts';
import { clientOps } from './client.ts';
import { leaseOps } from './leases.ts';
import { officeOps } from './office.ts';
import { peopleOps } from './people.ts';
import { placeOps } from './places.ts';
import { publicOps } from './public.ts';

/** Every migrated operation, by GraphQL operation name. Grows feature by feature (P4). */
export const OPS: Record<string, Op> = {
  ...publicOps,
  ...clientOps,
  ...placeOps,
  ...peopleOps,
  ...leaseOps,
  ...calendarOps,
  ...officeOps,
};
