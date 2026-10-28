import type { visitSettings as fr } from '../fr/visit-settings';

export const visitSettings: typeof fr = {
  title: 'الزيارات',
  description: 'اختر كيف يدفع الزائر رسوم الزيارة عندما يطلبها عقار.',
  methodLabel: 'طريقة دفع الزيارات',
  methods: {
    virtual: 'عن بُعد (تحويل بنكي، D17، Flouci…)',
    manual: 'في الموقع (نقدًا للوكيل)',
    none: 'مجاني',
  },
  instructionsLabel: 'كيفية الدفع عن بُعد',
  instructionsPlaceholder: 'مثال: تحويل إلى RIB TN59 ...، أو D17 على الرقم 71 000 000.',
  instructionsHelp: 'يُعرض هذا النص كما هو على العميل بمجرد تأكيد زيارته. إلزامي لطريقة «عن بُعد».',
  instructionsRequired: 'اشرح كيفية الدفع عن بُعد قبل حفظ هذه الطريقة.',
  save: 'حفظ',
  saved: 'تم حفظ التفضيل.',
  saveFailed: 'تعذر الحفظ.',
};
