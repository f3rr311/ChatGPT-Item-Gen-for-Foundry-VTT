import { describe, it, expect } from 'vitest';
import { sanitizeJSON, extractValidJSON } from '../scripts/utils/json-utils.js';

describe('sanitizeJSON', () => {
  it('returns valid JSON unchanged', () => {
    const valid = '{"name":"Sword","type":"weapon"}';
    expect(sanitizeJSON(valid)).toBe(valid);
  });

  it('strips markdown code fences', () => {
    const fenced = '```json\n{"name":"Sword"}\n```';
    const result = sanitizeJSON(fenced);
    expect(JSON.parse(result)).toEqual({ name: 'Sword' });
  });

  it('strips bare code fences without json tag', () => {
    const fenced = '```\n{"name":"Sword"}\n```';
    const result = sanitizeJSON(fenced);
    expect(JSON.parse(result)).toEqual({ name: 'Sword' });
  });

  it('removes trailing commas before }', () => {
    const bad = '{"name":"Sword","type":"weapon",}';
    const result = sanitizeJSON(bad);
    expect(JSON.parse(result)).toEqual({ name: 'Sword', type: 'weapon' });
  });

  it('removes trailing commas before ]', () => {
    const bad = '{"items":["a","b",]}';
    const result = sanitizeJSON(bad);
    expect(JSON.parse(result)).toEqual({ items: ['a', 'b'] });
  });

  it('handles combined issues (fences + trailing commas)', () => {
    const bad = '```json\n{"name":"Sword","type":"weapon",}\n```';
    const result = sanitizeJSON(bad);
    expect(JSON.parse(result)).toEqual({ name: 'Sword', type: 'weapon' });
  });

  it('returns cleaned string even if still unparseable', () => {
    const broken = '```json\n{broken json\n```';
    const result = sanitizeJSON(broken);
    expect(result).not.toContain('```');
  });
});

describe('extractValidJSON', () => {
  it('extracts JSON object from surrounding text', () => {
    const raw = 'Here is the item: {"name":"Dagger"} hope this helps!';
    const result = extractValidJSON(raw);
    expect(JSON.parse(result)).toEqual({ name: 'Dagger' });
  });

  it('handles trailing commas in extracted JSON', () => {
    const raw = 'Result: {"name":"Dagger","type":"weapon",}';
    const result = extractValidJSON(raw);
    expect(JSON.parse(result)).toEqual({ name: 'Dagger', type: 'weapon' });
  });

  it('attempts recovery on truncated JSON with missing braces', () => {
    const raw = '{"name":"Sword","items":[{"a":1';
    const result = extractValidJSON(raw);
    // Should attempt to close unclosed brackets/braces
    expect(result).toContain('}');
  });

  it('closes unclosed brackets in truncated JSON', () => {
    const raw = '{"items":["a","b"';
    const result = extractValidJSON(raw);
    expect(result).toContain(']');
    expect(result).toContain('}');
  });

  it('returns raw input when no JSON found', () => {
    const raw = 'no json here';
    expect(extractValidJSON(raw)).toBe(raw);
  });
});
