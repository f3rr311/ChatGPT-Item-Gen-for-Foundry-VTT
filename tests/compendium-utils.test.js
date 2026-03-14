import '../tests/mocks/foundry.js';
import { describe, it, expect } from 'vitest';

describe('compendium-utils module', () => {
  it('imports without errors', async () => {
    const mod = await import('../scripts/utils/compendium-utils.js');
    expect(mod).toBeDefined();
  });
});
