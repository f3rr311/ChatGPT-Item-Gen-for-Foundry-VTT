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
  items: { find: () => null },
  folders: { find: () => null },
  i18n: { localize: (key) => key },
  chatGPTItemGenerator: { history: [] }
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

globalThis.Item = {
  create: async (data) => ({ ...data, id: 'mock-id', uuid: 'mock-uuid' })
};

globalThis.Folder = {
  create: async (data) => ({ ...data, id: 'mock-folder-id' })
};

globalThis.RollTable = {
  create: async (data) => ({
    ...data,
    id: 'mock-table-id',
    createEmbeddedDocuments: async () => []
  })
};

globalThis.FilePicker = {
  createDirectory: async () => {},
  browse: async () => ({ files: [] }),
  upload: async () => ({ path: 'mock/path.webp' })
};

globalThis.console = globalThis.console || {};
