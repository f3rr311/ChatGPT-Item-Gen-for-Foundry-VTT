/**
 * Minimal Foundry VTT global mocks for unit testing.
 * Only stubs what the utility modules actually reference.
 */

let idCounter = 0;

globalThis.foundry = {
  utils: {
    randomID(length = 16) {
      idCounter++;
      return String(idCounter).padStart(length, '0');
    }
  }
};

globalThis.game = {
  settings: {
    get: () => '',
    set: () => {},
    register: () => {}
  },
  packs: new Map(),
  i18n: { localize: (key) => key }
};

globalThis.CONFIG = {
  DND5E: {
    spellSchools: {},
    itemActionTypes: {},
    abilityActivationTypes: {}
  }
};

globalThis.ui = {
  notifications: {
    info: () => {},
    warn: () => {},
    error: () => {}
  }
};

globalThis.console = globalThis.console || {};
