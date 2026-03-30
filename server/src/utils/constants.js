export const SLOT_LIMIT = 15;

export const CLASS_SLOTS = {
  1: { label: 'Class 01', time: '08:00 AM - 09:00 AM', period: 'Morning' },
  2: { label: 'Class 02', time: '09:00 AM - 10:00 AM', period: 'Morning' },
  3: { label: 'Class 03', time: '05:00 PM - 06:00 PM', period: 'Evening' },
  4: { label: 'Class 04', time: '06:00 PM - 07:00 PM', period: 'Evening' },
};

export const BATCH_PRESETS = {
  Regular: {
    days: 30,
    pricing: {
      kids: 12000,
      adults: 9000,
    },
    totalClasses: {
      kids: 16,
      adults: 12,
    },
  },
  Weekend: {
    days: 40,
    pricing: {
      kids: 13000,
      adults: 11000,
    },
    totalClasses: {
      kids: 16,
      adults: 12,
    },
  },
};

export const PLAN_PRESETS = {
  Monthly: 30,
  Quarterly: 90,
  'Half-Yearly': 180,
  Yearly: 365,
};
