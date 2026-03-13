import { describe, it, expect } from 'vitest';
import { parseDescriptionForArmor } from '../scripts/utils/armor-utils.js';

describe('parseDescriptionForArmor', () => {
  it('identifies plate armor', () => {
    const result = parseDescriptionForArmor('This magical plate armor glows with divine light.');
    expect(result).not.toBeNull();
    expect(result.armorType).toBe('heavy');
    expect(result.ac).toBe(18);
    expect(result.baseItem).toBe('plate');
  });

  it('identifies chain mail', () => {
    const result = parseDescriptionForArmor('A suit of chain mail enchanted by elven smiths.');
    expect(result).not.toBeNull();
    expect(result.armorType).toBe('heavy');
    expect(result.ac).toBe(16);
  });

  it('identifies studded leather before plain leather', () => {
    const result = parseDescriptionForArmor('Studded leather armor of the night.');
    expect(result).not.toBeNull();
    expect(result.ac).toBe(12);
    expect(result.baseItem).toBe('studdedleather');
  });

  it('identifies half plate', () => {
    const result = parseDescriptionForArmor('Enchanted half plate forged in fire.');
    expect(result).not.toBeNull();
    expect(result.armorType).toBe('medium');
    expect(result.ac).toBe(15);
  });

  it('identifies shield', () => {
    const result = parseDescriptionForArmor('A magical shield bearing a holy symbol.');
    expect(result).not.toBeNull();
    expect(result.armorType).toBe('shield');
    expect(result.ac).toBe(2);
  });

  it('handles armor aliases', () => {
    const result = parseDescriptionForArmor('Plate armor of the dragon.');
    expect(result).not.toBeNull();
    expect(result.baseItem).toBe('plate');
  });

  it('handles HTML in description', () => {
    const result = parseDescriptionForArmor('<p>This <strong>leather</strong> armor is enchanted.</p>');
    expect(result).not.toBeNull();
    expect(result.armorType).toBe('light');
  });

  it('returns null for non-armor text', () => {
    expect(parseDescriptionForArmor('A magical sword of fire.')).toBeNull();
  });

  it('returns null for null/empty input', () => {
    expect(parseDescriptionForArmor(null)).toBeNull();
    expect(parseDescriptionForArmor('')).toBeNull();
  });

  it('returns correct dexCap for medium armor', () => {
    const result = parseDescriptionForArmor('breastplate');
    expect(result.dexCap).toBe(2);
  });

  it('returns dexCap 0 for heavy armor', () => {
    const result = parseDescriptionForArmor('splint');
    expect(result.dexCap).toBe(0);
  });

  it('returns null dexCap for light armor', () => {
    const result = parseDescriptionForArmor('leather');
    expect(result.dexCap).toBeNull();
  });
});
