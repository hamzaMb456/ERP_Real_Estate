// Daily job (EventBridge Scheduler, 05:00 UTC = 06:00 Tunis): replaces the Hasura lease_daily cron.
// Order matters: expire leases first, so the notifications see the new statuses.
import { todayTunis } from '../domain/dates.ts';
import { expireOverdueLeases } from '../domain/leases.ts';
import { generateDailyNotifications } from '../domain/notifications.ts';
import { refreshCurrentOwners } from '../domain/ownerships.ts';
import { resyncAllPublicListings } from '../domain/public-listings.ts';

export const handler = async () => {
  const today = todayTunis();
  const leases = await expireOverdueLeases(today);
  const owners = await refreshCurrentOwners(today);
  const notifications = await generateDailyNotifications(today);
  const listings = await resyncAllPublicListings();
  const summary = {
    today,
    expired: leases.expired.length,
    expireFailed: leases.failed,
    ownersRefreshed: owners.refreshed,
    ownersFailed: owners.failed,
    notifications: notifications.length,
    listed: listings.listed,
    listingsFailed: listings.failed,
  };
  console.log('daily job:', JSON.stringify(summary));
  return summary;
};
