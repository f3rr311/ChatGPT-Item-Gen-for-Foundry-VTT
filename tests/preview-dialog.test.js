import '../tests/mocks/foundry.js';
import { describe, it, expect } from 'vitest';

// UI dialogs require full Foundry Dialog class mocking.
// This test verifies the module loads without import errors.

describe('preview-dialog module', () => {
  it('imports without errors', async () => {
    const mod = await import('../scripts/ui/preview-dialog.js');
    expect(mod).toBeDefined();
  });
});
