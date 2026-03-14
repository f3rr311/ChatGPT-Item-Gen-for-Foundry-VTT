import '../tests/mocks/foundry.js';
import { describe, it, expect } from 'vitest';

describe('description-validator module', () => {
  it('imports validateAndEnrichItem without errors', async () => {
    const mod = await import('../scripts/utils/description-validator.js');
    expect(mod.validateAndEnrichItem).toBeTypeOf('function');
  });

  it('validateAndEnrichItem runs without throwing for weapon', async () => {
    const { validateAndEnrichItem } = await import('../scripts/utils/description-validator.js');

    const itemData = {
      img: '',
      effects: [],
      system: {
        activities: {},
        type: { value: 'simpleM' },
        description: { value: 'A flaming sword that grants resistance to fire damage and deals extra 2d6 fire damage.' }
      }
    };

    // Should complete without error
    await expect(validateAndEnrichItem(
      itemData,
      'A flaming sword that grants resistance to fire damage and deals extra 2d6 fire damage.',
      'weapon',
      { apiKey: '', lightModel: 'gpt-4.1-mini' }
    )).resolves.not.toThrow();
  });

  it('validateAndEnrichItem skips empty descriptions', async () => {
    const { validateAndEnrichItem } = await import('../scripts/utils/description-validator.js');

    const itemData = {
      img: '',
      effects: [],
      system: { activities: {}, description: { value: '' } }
    };

    // Should return early without modifying
    await validateAndEnrichItem(itemData, '', 'weapon', { apiKey: '' });
    expect(Object.keys(itemData.system.activities).length).toBe(0);
    expect(itemData.effects.length).toBe(0);
  });
});
