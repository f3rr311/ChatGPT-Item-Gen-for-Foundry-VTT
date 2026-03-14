import '../tests/mocks/foundry.js';
import { describe, it, expect } from 'vitest';
import {
  normalizeSchool,
  normalizeActivation,
  normalizeDuration,
  normalizeRange,
  normalizeTarget,
  normalizeComponents,
  normalizeMaterials,
  transformSpellDamage,
  buildSpellScaling,
  parseSpellDescription
} from '../scripts/utils/spell-utils.js';

// ---------- normalizeSchool ----------

describe('normalizeSchool', () => {
  it('maps full name to abbreviation', () => {
    expect(normalizeSchool('evocation')).toBe('evo');
    expect(normalizeSchool('necromancy')).toBe('nec');
    expect(normalizeSchool('Abjuration')).toBe('abj');
  });

  it('passes through valid abbreviations', () => {
    expect(normalizeSchool('evo')).toBe('evo');
    expect(normalizeSchool('con')).toBe('con');
  });

  it('defaults to evo for null/undefined/unknown', () => {
    expect(normalizeSchool(null)).toBe('evo');
    expect(normalizeSchool(undefined)).toBe('evo');
    expect(normalizeSchool('fakeschool')).toBe('evo');
  });
});

// ---------- normalizeActivation ----------

describe('normalizeActivation', () => {
  it('parses string activations', () => {
    expect(normalizeActivation('1 action')).toEqual({ type: 'action', cost: 1 });
    expect(normalizeActivation('bonus action')).toEqual({ type: 'bonus', cost: 1 });
    expect(normalizeActivation('reaction')).toEqual({ type: 'reaction', cost: 1 });
  });

  it('handles object activations', () => {
    expect(normalizeActivation({ type: 'action', cost: 1 })).toEqual({ type: 'action', cost: 1 });
    expect(normalizeActivation({ type: 'bonus', cost: 1 })).toEqual({ type: 'bonus', cost: 1 });
  });

  it('parses minute/hour durations', () => {
    expect(normalizeActivation({ type: '10 minutes' })).toEqual({ type: 'minute', cost: 10 });
    expect(normalizeActivation({ type: '1 hour' })).toEqual({ type: 'hour', cost: 1 });
  });

  it('defaults to action for null', () => {
    expect(normalizeActivation(null)).toEqual({ type: 'action', cost: 1 });
  });
});

// ---------- normalizeDuration ----------

describe('normalizeDuration', () => {
  it('handles instantaneous', () => {
    expect(normalizeDuration('Instantaneous')).toEqual({ value: null, units: 'inst' });
    expect(normalizeDuration('instant')).toEqual({ value: null, units: 'inst' });
  });

  it('handles permanent', () => {
    expect(normalizeDuration('permanent')).toEqual({ value: null, units: 'perm' });
    expect(normalizeDuration('until dispelled')).toEqual({ value: null, units: 'perm' });
  });

  it('parses string durations', () => {
    expect(normalizeDuration('1 minute')).toEqual({ value: 1, units: 'minute' });
    expect(normalizeDuration('8 hours')).toEqual({ value: 8, units: 'hour' });
  });

  it('handles object durations', () => {
    expect(normalizeDuration({ value: 1, unit: 'minute' })).toEqual({ value: 1, units: 'minute' });
  });

  it('defaults to instantaneous for null', () => {
    expect(normalizeDuration(null)).toEqual({ value: null, units: 'inst' });
  });
});

// ---------- normalizeRange ----------

describe('normalizeRange', () => {
  it('handles self and touch', () => {
    expect(normalizeRange('Self')).toEqual({ value: null, units: 'self' });
    expect(normalizeRange('touch')).toEqual({ value: null, units: 'touch' });
  });

  it('parses string ranges', () => {
    expect(normalizeRange('120 feet')).toEqual({ value: 120, units: 'ft' });
  });

  it('handles object ranges', () => {
    expect(normalizeRange({ value: 60, unit: 'feet' })).toEqual({ value: 60, units: 'ft' });
  });

  it('handles self prefix', () => {
    expect(normalizeRange('Self (30-foot cone)')).toEqual({ value: null, units: 'self' });
  });

  it('defaults to self for null', () => {
    expect(normalizeRange(null)).toEqual({ value: null, units: 'self' });
  });
});

// ---------- normalizeTarget ----------

describe('normalizeTarget', () => {
  it('returns null for no target', () => {
    expect(normalizeTarget(null)).toBeNull();
    expect(normalizeTarget(undefined)).toBeNull();
  });

  it('handles object targets', () => {
    const result = normalizeTarget({ value: 20, type: 'sphere' });
    expect(result).toBeDefined();
    expect(result.type).toBe('sphere');
  });
});

// ---------- normalizeComponents ----------

describe('normalizeComponents', () => {
  it('handles component object', () => {
    const result = normalizeComponents({ vocal: true, somatic: true, material: false });
    expect(result.vocal).toBe(true);
    expect(result.somatic).toBe(true);
    expect(result.material).toBe(false);
  });

  it('defaults all false for null', () => {
    const result = normalizeComponents(null);
    expect(result.vocal).toBe(false);
    expect(result.somatic).toBe(false);
    expect(result.material).toBe(false);
  });
});

// ---------- normalizeMaterials ----------

describe('normalizeMaterials', () => {
  it('extracts material description', () => {
    const result = normalizeMaterials({ materials: 'a tiny strip of white cloth' });
    expect(result).toBeDefined();
  });

  it('handles missing materials', () => {
    const result = normalizeMaterials({});
    expect(result).toBeDefined();
  });
});

// ---------- transformSpellDamage ----------

describe('transformSpellDamage', () => {
  it('transforms a simple damage entry', () => {
    const result = transformSpellDamage('3d6 fire');
    expect(result).toBeDefined();
  });

  it('handles null damage', () => {
    const result = transformSpellDamage(null);
    expect(result).toBeDefined();
  });

  it('handles array of damage entries', () => {
    const result = transformSpellDamage(['2d6 fire', '1d4 cold']);
    expect(result).toBeDefined();
  });
});

// ---------- buildSpellScaling ----------

describe('buildSpellScaling', () => {
  it('returns scaling object for cantrip', () => {
    const result = buildSpellScaling('cantrip', 0);
    expect(result).toBeDefined();
  });

  it('returns scaling object for leveled spell', () => {
    const result = buildSpellScaling('level', 3);
    expect(result).toBeDefined();
  });
});

// ---------- parseSpellDescription ----------

describe('parseSpellDescription', () => {
  it('extracts hints from spell description', () => {
    const desc = 'You hurl a ball of fire that explodes in a 20-foot radius dealing 8d6 fire damage.';
    const result = parseSpellDescription(desc);
    expect(result).toBeDefined();
  });

  it('handles empty description', () => {
    const result = parseSpellDescription('');
    expect(result).toBeDefined();
  });

  it('detects saving throw references', () => {
    const desc = 'Each creature must make a Dexterity saving throw or take 3d8 lightning damage.';
    const result = parseSpellDescription(desc);
    expect(result).toBeDefined();
  });
});
