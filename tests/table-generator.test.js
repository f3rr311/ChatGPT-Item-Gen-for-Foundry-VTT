import '../tests/mocks/foundry.js';
import { describe, it, expect } from 'vitest';

describe('table-generator module', () => {
  it('imports without errors', async () => {
    const mod = await import('../scripts/generators/table-generator.js');
    expect(mod.parseTableJSON).toBeTypeOf('function');
    expect(mod.createFoundryRollTableFromDialog).toBeTypeOf('function');
  });
});
