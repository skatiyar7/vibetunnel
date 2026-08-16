/**
 * @vitest-environment happy-dom
 */
import { fixture, html } from '@open-wc/testing';
import { describe, expect, it, vi } from 'vitest';
import type { OverlaysCallbacks, OverlaysContainer } from './overlays-container.js';
import { UIStateManager } from './ui-state-manager.js';
import './overlays-container.js';

const createCallbacks = (): OverlaysCallbacks => ({
  onCtrlKey: vi.fn(),
  onSendCtrlSequence: vi.fn(),
  onClearCtrlSequence: vi.fn(),
  onCtrlAlphaCancel: vi.fn(),
  onQuickKeyPress: vi.fn(),
  onCloseFileBrowser: vi.fn(),
  onInsertPath: vi.fn(),
  onFileSelected: vi.fn(),
  onFileError: vi.fn(),
  onCloseFilePicker: vi.fn(),
  onWidthSelect: vi.fn(),
  onFontSizeChange: vi.fn(),
  onThemeChange: vi.fn(),
  onCloseWidthSelector: vi.fn(),
  handleBack: vi.fn(),
});

describe('OverlaysContainer', () => {
  it('does not render a floating keyboard button on mobile', async () => {
    const uiStateManager = new UIStateManager();
    uiStateManager.setIsMobile(true);
    const callbacks = createCallbacks();
    const element = await fixture<OverlaysContainer>(html`
      <overlays-container
        .uiState=${uiStateManager.getState()}
        .callbacks=${callbacks}
      ></overlays-container>
    `);

    expect(element.querySelector('.mobile-keyboard-button')).toBeNull();
  });
});
