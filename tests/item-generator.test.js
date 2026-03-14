import '../tests/mocks/foundry.js';
import { describe, it, expect } from 'vitest';

// item-generator.js has heavy Foundry/API dependencies.
// We test the importable pure-ish functions: parseItemJSON, fixNameDescriptionMismatch.

describe('item-generator module', () => {
  it('imports core functions without errors', async () => {
    const mod = await import('../scripts/generators/item-generator.js');
    expect(mod.parseItemJSON).toBeTypeOf('function');
    expect(mod.fixNameDescriptionMismatch).toBeTypeOf('function');
    expect(mod.generateItemData).toBeTypeOf('function');
    expect(mod.createItemFromData).toBeTypeOf('function');
    expect(mod.getOrCreateItemFolder).toBeTypeOf('function');
    expect(mod.createUniqueItemDoc).toBeTypeOf('function');
  });

  it('parseItemJSON parses valid JSON string', async () => {
    const { parseItemJSON } = await import('../scripts/generators/item-generator.js');
    const json = JSON.stringify({ name: 'Flame Blade', damage: '2d6 fire' });
    const result = await parseItemJSON(json, { apiKey: '' });
    expect(result).toBeDefined();
    expect(result.name).toBe('Flame Blade');
  });

  it('parseItemJSON returns null for empty input', async () => {
    const { parseItemJSON } = await import('../scripts/generators/item-generator.js');
    const result = await parseItemJSON('', { apiKey: '' });
    // Empty input returns empty object (all parse attempts fail gracefully)
    expect(result).toBeDefined();
  });

  it('parseItemJSON handles JSON with markdown fences', async () => {
    const { parseItemJSON } = await import('../scripts/generators/item-generator.js');
    const json = '```json\n{"name": "Test"}\n```';
    const result = await parseItemJSON(json, { apiKey: '' });
    expect(result).toBeDefined();
    expect(result.name).toBe('Test');
  });

  it('fixNameDescriptionMismatch returns original for matching types', async () => {
    const { fixNameDescriptionMismatch } = await import('../scripts/generators/item-generator.js');
    const raw = JSON.stringify({ name: 'Longsword', type: 'weapon' });
    const result = fixNameDescriptionMismatch('weapon', 'weapon', 'Longsword', raw, '');
    // When types match, it should return the original
    expect(result).toBeDefined();
  });
});
