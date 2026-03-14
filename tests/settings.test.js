import '../tests/mocks/foundry.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MODULE_ID, registerSettings } from '../scripts/settings.js';

describe('settings', () => {
  beforeEach(() => {
    game.settings.register = vi.fn();
  });

  it('exports correct MODULE_ID', () => {
    expect(MODULE_ID).toBe('chatgpt-item-generator');
  });

  it('registers settings without throwing', () => {
    expect(() => registerSettings()).not.toThrow();
  });

  it('registers at least 5 settings', () => {
    registerSettings();
    expect(game.settings.register.mock.calls.length).toBeGreaterThanOrEqual(5);
  });

  it('registers settings under the correct module ID', () => {
    registerSettings();
    for (const call of game.settings.register.mock.calls) {
      expect(call[0]).toBe(MODULE_ID);
    }
  });

  it('registers openaiApiKey setting', () => {
    registerSettings();
    const keys = game.settings.register.mock.calls.map(c => c[1]);
    expect(keys).toContain('openaiApiKey');
  });

  it('registers chatModel setting', () => {
    registerSettings();
    const keys = game.settings.register.mock.calls.map(c => c[1]);
    expect(keys).toContain('chatModel');
  });

  it('all settings have name and default', () => {
    registerSettings();
    for (const call of game.settings.register.mock.calls) {
      const config = call[2];
      expect(config).toHaveProperty('name');
      expect(config).toHaveProperty('default');
    }
  });
});
