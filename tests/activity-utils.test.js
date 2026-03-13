import { describe, it, expect } from 'vitest';
import {
  buildAttackActivity,
  buildSaveActivity,
  buildDamageActivity,
  buildHealActivity,
  buildUtilityActivity,
  buildCastActivity,
  buildDamagePart,
  buildActiveEffect,
  mapEffectChange,
  durationToSeconds
} from '../scripts/utils/activity-utils.js';

describe('buildAttackActivity', () => {
  it('creates a melee weapon attack', () => {
    const activity = buildAttackActivity('melee', 'weapon', '+1');
    expect(activity.type).toBe('attack');
    expect(activity.attack.type.value).toBe('melee');
    expect(activity.attack.type.classification).toBe('weapon');
    expect(activity.attack.bonus).toBe('+1');
    expect(activity._id).toBeTruthy();
  });

  it('creates a ranged spell attack', () => {
    const activity = buildAttackActivity('ranged', 'spell');
    expect(activity.attack.type.value).toBe('ranged');
    expect(activity.attack.type.classification).toBe('spell');
    expect(activity.attack.bonus).toBe('');
  });
});

describe('buildSaveActivity', () => {
  it('creates a dex save activity', () => {
    const parts = [buildDamagePart('fire', 8, 6)];
    const activity = buildSaveActivity('dex', parts, 'half');
    expect(activity.type).toBe('save');
    expect(activity.save.ability).toEqual(['dex']);
    expect(activity.damage.onSave).toBe('half');
    expect(activity.damage.parts).toHaveLength(1);
  });

  it('defaults to spellcasting DC', () => {
    const activity = buildSaveActivity('wis');
    expect(activity.save.dc.calculation).toBe('spellcasting');
  });
});

describe('buildDamageActivity', () => {
  it('creates a damage-only activity', () => {
    const parts = [buildDamagePart('radiant', 2, 8)];
    const activity = buildDamageActivity(parts, 'Smite');
    expect(activity.type).toBe('damage');
    expect(activity.name).toBe('Smite');
  });
});

describe('buildHealActivity', () => {
  it('creates a healing activity with dice', () => {
    const activity = buildHealActivity(2, 4, '2');
    expect(activity.type).toBe('heal');
    expect(activity.healing.number).toBe(2);
    expect(activity.healing.denomination).toBe(4);
    expect(activity.healing.bonus).toBe('2');
    expect(activity.healing.types).toEqual(['healing']);
  });
});

describe('buildUtilityActivity', () => {
  it('creates a utility activity', () => {
    const activity = buildUtilityActivity('Use', 'bonus');
    expect(activity.type).toBe('utility');
    expect(activity.name).toBe('Use');
    expect(activity.activation.type).toBe('bonus');
  });

  it('defaults to action activation', () => {
    const activity = buildUtilityActivity();
    expect(activity.activation.type).toBe('action');
  });
});

describe('buildCastActivity', () => {
  it('creates a cast activity with spell UUID', () => {
    const activity = buildCastActivity('Compendium.dnd5e.spells.Item.web', 2, 'Cast Web');
    expect(activity.type).toBe('cast');
    expect(activity.spell.uuid).toBe('Compendium.dnd5e.spells.Item.web');
    expect(activity.name).toBe('Cast Web');
    expect(activity.consumption.targets[0].value).toBe('2');
  });
});

describe('buildDamagePart', () => {
  it('creates a damage part with single type', () => {
    const part = buildDamagePart('fire', 2, 6, '+1');
    expect(part.types).toEqual(['fire']);
    expect(part.number).toBe(2);
    expect(part.denomination).toBe(6);
    expect(part.bonus).toBe('+1');
  });

  it('accepts array of types', () => {
    const part = buildDamagePart(['fire', 'radiant'], 1, 8);
    expect(part.types).toEqual(['fire', 'radiant']);
  });

  it('sets scaling mode', () => {
    const part = buildDamagePart('fire', 1, 10, '', 'whole');
    expect(part.scaling.mode).toBe('whole');
  });
});

describe('buildActiveEffect', () => {
  it('creates an effect with changes', () => {
    const changes = [{ key: 'system.traits.dr.value', mode: 0, value: 'fire' }];
    const effect = buildActiveEffect('Fire Resistance', changes);
    expect(effect.name).toBe('Fire Resistance');
    expect(effect.changes).toHaveLength(1);
    expect(effect.changes[0].key).toBe('system.traits.dr.value');
    expect(effect._id).toBeTruthy();
  });

  it('respects transfer option', () => {
    const effect = buildActiveEffect('Buff', [], { transfer: false });
    expect(effect.transfer).toBe(false);
  });

  it('applies duration', () => {
    const effect = buildActiveEffect('Shield', [], { duration: { seconds: 60 } });
    expect(effect.duration.seconds).toBe(60);
  });
});

describe('mapEffectChange', () => {
  it('maps advantage.stealth correctly', () => {
    const change = mapEffectChange('advantage', 'stealth', true);
    expect(change.key).toBe('system.skills.ste.roll.mode');
    expect(change.value).toBe('1');
  });

  it('maps resistance.fire correctly', () => {
    const change = mapEffectChange('resistance', 'fire', null);
    expect(change.key).toBe('system.traits.dr.value');
    expect(change.value).toBe('fire');
  });

  it('maps bonus.ac with dynamic value', () => {
    const change = mapEffectChange('bonus', 'ac', 2);
    expect(change.key).toBe('system.attributes.ac.bonus');
    expect(change.value).toBe('2');
  });

  it('maps sense.darkvision', () => {
    const change = mapEffectChange('sense', 'darkvision', 60);
    expect(change.key).toBe('system.attributes.senses.darkvision');
    expect(change.value).toBe('60');
  });

  it('returns null for unknown mappings', () => {
    expect(mapEffectChange('unknown', 'thing', 1)).toBeNull();
  });

  it('returns null for null inputs', () => {
    expect(mapEffectChange(null, null, null)).toBeNull();
  });
});

describe('durationToSeconds', () => {
  it('converts rounds to seconds', () => {
    expect(durationToSeconds('round', 10)).toBe(60);
  });

  it('converts minutes to seconds', () => {
    expect(durationToSeconds('minute', 10)).toBe(600);
  });

  it('converts hours to seconds', () => {
    expect(durationToSeconds('hour', 1)).toBe(3600);
  });

  it('converts days to seconds', () => {
    expect(durationToSeconds('day', 1)).toBe(86400);
  });

  it('returns null for instantaneous', () => {
    expect(durationToSeconds('inst', 0)).toBeNull();
  });

  it('handles string value input', () => {
    expect(durationToSeconds('minute', '5')).toBe(300);
  });
});
