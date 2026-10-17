import type { notifications as fr } from '../fr/notifications';
import { plural } from '../../plural';

export const notifications: typeof fr = {
  bellUnread: (count: number) =>
    plural(count, {
      zero: 'الإشعارات، لا يوجد إشعار غير مقروء',
      one: 'الإشعارات، إشعار واحد غير مقروء',
      two: 'الإشعارات، إشعاران غير مقروءين',
      few: 'الإشعارات، # إشعارات غير مقروءة',
      many: 'الإشعارات، # إشعارًا غير مقروء',
      other: 'الإشعارات، # إشعار غير مقروء',
    }),
  unread: 'غير مقروء',
  markAllRead: 'تعليم الكل كمقروء',
  loadError: 'تعذّر تحميل الإشعارات.',
  markAllReadError: 'تعذّر تعليم الإشعارات كمقروءة',
  markReadError: 'تعذّر تعليم الإشعار كمقروء',
  kinds: {
    lease_ending_soon: 'عقد إيجار يقترب من نهايته',
    lease_grace: 'عقد إيجار منتهي المدة · للتجديد',
    lease_expired: 'عقد إيجار منتهي الصلاحية',
    registration_due: 'تسجيل يجب القيام به',
    registration_overdue: 'تسجيل متأخر',
    appointment_reminder: 'تذكير بموعد',
  },
};
