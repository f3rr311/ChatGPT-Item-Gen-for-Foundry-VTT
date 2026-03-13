import { describe, it, expect } from 'vitest';
import {
  parseDamageFormula,
  calculateVersatileDamage,
  buildVersatileDamage,
  parseDescriptionBonuses,
  transformWeaponDamage,
  transformWeaponProperties
} from '../scripts/utils/weapon-utils.js';

describe('parseDamageFormula', () => {
  it('parses simple formula "1d8"', () => {
    expect(parseDamageFormula('1d8')).toEqual({ number: 1, denomination: 8, bonus: '' });
  });

  it('parses formula with positive bonus "2d6+2"', () => {
    expect(parseDamageFormula('2d6+2')).toEqual({ number: 2, denomination: 6, bonus: '+2' });
  });

  it('parses formula with negative bonus "1d10-1"', () => {
    expect(parseDamageFormula('1d10-1')).toEqual({ number: 1, denomination: 10, bonus: '-1' });
  });

  it('parses formula with spaces "1d8 + 3"', () => {
    expect(parseDamageFormula('1d8 + 3')).toEqual({ number: 1, denomination: 8, bonus: '+3' });
  });

  it('returns null for non-formula strings', () => {
    expect(parseDamageFormula('not a formula')).toBeNull();
    expect(parseDamageFormula('')).toBeNull();
    expect(parseDamageFormula(null)).toBeNull();
    expect(parseDamageFormula(undefined)).toBeNull();
  });
});

describe('calculateVersatileDamage', () => {
  it('bumps d6 to d8', () => {
    const result = calculateVersatileDamage({ number: 1, denomination: 6, bonus: '' });
    expect(result.denomination).toBe(8);
  });

  it('bumps d8 to d10', () => {
    const result = calculateVersatileDamage({ number: 1, denomination: 8, bonus: '' });
    expect(result.denomination).toBe(10);
  });

  it('caps d12 at d12', () => {
    const result = calculateVersatileDamage({ number: 1, denomination: 12, bonus: '' });
    expect(result.denomination).toBe(12);
  });

  it('returns null for null input', () => {
    expect(calculateVersatileDamage(null)).toBeNull();
  });
});

describe('buildVersatileDamage', () => {
  it('uses GPT explicit data when provided', () => {
    const gptVersatile = { number: 1, denomination: 10, type: 'slashing' };
    const result = buildVersatileDamage(gptVersatile, null, 'slashing');
    expect(result.denomination).toBe(10);
    expect(result.types).toEqual(['slashing']);
  });

  it('auto-calculates from base when no GPT data', () => {
    const base = { number: 1, denomination: 8, bonus: '' };
    const result = buildVersatileDamage(null, base, 'slashing');
    expect(result.denomination).toBe(10);
    expect(result.types).toEqual(['slashing']);
  });

  it('returns null when no GPT data and no base', () => {
    expect(buildVersatileDamage(null, null, 'slashing')).toBeNull();
  });
});

describe('parseDescriptionBonuses', () => {
  it('extracts +1 magical bonus', () => {
    const desc = 'This is a +1 weapon of great power.';
    const result = parseDescriptionBonuses(desc);
    expect(result.magicalBonus).toBe(1);
  });

  it('extracts +2 bonus from "grants a +2 bonus"', () => {
    const desc = 'This blade grants a +2 bonus to attack and damage rolls.';
    const result = parseDescriptionBonuses(desc);
    expect(result.magicalBonus).toBe(2);
  });

  it('extracts damage from description', () => {
    const desc = 'This weapon deals 1d8 fire damage on hit.';
    const result = parseDescriptionBonuses(desc);
    expect(result.damage).toEqual({ formula: '1d8', type: 'fire' });
  });

  it('extracts extra damage', () => {
    const desc = 'Deals 1d8 slashing damage plus additional 1d6 fire damage.';
    const result = parseDescriptionBonuses(desc);
    expect(result.extraDamage.length).toBe(1);
    expect(result.extraDamage[0].type).toBe('fire');
  });

  it('identifies weapon hint from description', () => {
    const desc = 'This magical longsword was forged in dragon fire.';
    const result = parseDescriptionBonuses(desc);
    expect(result.weaponHint).not.toBeNull();
    expect(result.weaponHint.baseItem).toBe('longsword');
    expect(result.weaponHint.classification).toBe('martialM');
  });

  it('maps generic weapon names to PHB defaults', () => {
    const desc = 'A glowing sword found in the dungeon.';
    const result = parseDescriptionBonuses(desc);
    expect(result.weaponHint).not.toBeNull();
    expect(result.weaponHint.baseItem).toBe('longsword');
  });

  it('returns empty results for null/empty input', () => {
    const result = parseDescriptionBonuses(null);
    expect(result.magicalBonus).toBeNull();
    expect(result.damage).toBeNull();
    expect(result.extraDamage).toEqual([]);
    expect(result.weaponHint).toBeNull();
  });
});

describe('transformWeaponDamage', () => {
  it('returns empty parts for null damage (v3)', () => {
    expect(transformWeaponDamage(null, false)).toEqual({ parts: [] });
  });

  it('returns empty object for null damage (v4)', () => {
    expect(transformWeaponDamage(null, true)).toEqual({});
  });

  it('passes through v4 format unchanged', () => {
    const v4 = { base: { number: 1, denomination: 8, bonus: '', types: ['slashing'] } };
    expect(transformWeaponDamage(v4, true)).toEqual(v4);
  });

  it('converts structured GPT damage to v4', () => {
    const gpt = { number: 2, die: 'd6', bonus: 2, type: 'slashing' };
    const result = transformWeaponDamage(gpt, true);
    expect(result.base.number).toBe(2);
    expect(result.base.denomination).toBe(6);
    expect(result.base.bonus).toBe('+2');
    expect(result.base.types).toEqual(['slashing']);
  });

  it('converts parts array to v3 format', () => {
    const parts = [['1d8', 'slashing']];
    const result = transformWeaponDamage(parts, false);
    expect(result.parts).toEqual(parts);
  });

  it('parses formula-based damage to v4', () => {
    const damage = { base: { formula: '1d8', types: ['piercing'] } };
    const result = transformWeaponDamage(damage, true);
    expect(result.base.number).toBe(1);
    expect(result.base.denomination).toBe(8);
  });
});

describe('transformWeaponProperties', () => {
  it('maps full names to abbreviations', () => {
    const result = transformWeaponProperties(['finesse', 'light', 'thrown'], true);
    expect(result).toEqual(['fin', 'lgt', 'thr']);
  });

  it('passes through already-abbreviated codes', () => {
    const result = transformWeaponProperties(['fin', 'lgt'], true);
    expect(result).toEqual(['fin', 'lgt']);
  });

  it('handles object format properties', () => {
    const result = transformWeaponProperties({ finesse: true, heavy: true, light: false }, true);
    expect(result).toContain('fin');
    expect(result).toContain('hvy');
    expect(result).not.toContain('lgt');
  });

  it('returns empty array for null input', () => {
    expect(transformWeaponProperties(null)).toEqual([]);
  });

  it('returns raw values without abbreviation flag', () => {
    const result = transformWeaponProperties(['finesse', 'light'], false);
    expect(result).toEqual(['finesse', 'light']);
  });
});
