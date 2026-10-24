import type { visitSettings as fr } from '../fr/visit-settings';

export const visitSettings: typeof fr = {
  title: 'الزيارات',
  description: 'اختر كيف يدفع الزائر رسوم الزيارة عندما يطلبها عقار.',
  methodLabel: 'طريقة دفع الزيارات',
  methods: {
    virtual: 'عن بُعد',
    manual: 'يدوي',
    none: 'مجاني',
  },
  save: 'حفظ',
  saved: 'تم حفظ التفضيل.',
  saveFailed: 'تعذر الحفظ.',
};
