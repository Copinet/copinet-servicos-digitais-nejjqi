import * as schema from './schema.js';
import type { App } from '../index.js';

export async function seedPricingConfig(app: App) {
  try {
    // Check if pricing config already exists
    const existingConfig = await app.db.query.pricingConfig.findMany();

    if (existingConfig.length > 0) {
      app.logger.info({ count: existingConfig.length }, 'Pricing config already seeded, skipping');
      return;
    }

    const pricingData = [
      {
        serviceType: 'quick_print',
        pricePerPage: '0.50',
        photoSizes: null,
      },
      {
        serviceType: 'photo_print',
        pricePerPage: null,
        photoSizes: {
          '10x15': 2.00,
          '13x18': 3.50,
          '15x21': 5.00,
          '21x29': 8.00,
        },
      },
      {
        serviceType: 'photo_3x4',
        pricePerPage: '10.00',
        photoSizes: null,
      },
      {
        serviceType: 'scan_to_pdf',
        pricePerPage: '0.30',
        photoSizes: null,
      },
    ];

    await app.db.insert(schema.pricingConfig).values(pricingData);
    app.logger.info({ count: pricingData.length }, 'Pricing config seeded successfully');
  } catch (error) {
    app.logger.error({ err: error }, 'Failed to seed pricing config');
  }
}
