// @vitest-environment happy-dom

import { fixture, html } from '@open-wc/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockSession } from '@/test/utils/lit-test-utils';
import type { SessionHeader } from './session-header.js';

const terminalSocketClientMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  subscribe: vi.fn(() => () => {}),
  getConnectionStatus: vi.fn(() => true),
  onConnectionStateChange: vi.fn(() => () => {}),
}));

vi.mock('../../services/terminal-socket-client.js', () => ({
  terminalSocketClient: terminalSocketClientMock,
}));

import './session-header.js';

describe('SessionHeader', () => {
  const elements: SessionHeader[] = [];

  afterEach(() => {
    for (const element of elements) {
      element.remove();
    }
    elements.length = 0;
  });

  async function renderHeader(options: {
    isMobile: boolean;
    sessionName?: string;
    showBackButton?: boolean;
    showSidebarToggle?: boolean;
    sidebarCollapsed?: boolean;
    onBack?: () => void;
    onSidebarToggle?: () => void;
    onSpecialKey?: (key: string) => void;
    onSendText?: (text: string) => void;
  }): Promise<SessionHeader> {
    const element = await fixture<SessionHeader>(html`
      <session-header
        .session=${createMockSession({
          id: 'header-controls',
          name: options.sessionName,
        })}
        .isMobile=${options.isMobile}
        .showBackButton=${options.showBackButton ?? false}
        .showSidebarToggle=${options.showSidebarToggle ?? false}
        .sidebarCollapsed=${options.sidebarCollapsed ?? false}
        .onBack=${options.onBack}
        .onSidebarToggle=${options.onSidebarToggle}
        .onSpecialKey=${options.onSpecialKey}
        .onSendText=${options.onSendText}
      ></session-header>
    `);
    elements.push(element);
    return element;
  }

  it('renders the compact mobile navigation row and preserves callbacks', async () => {
    const onBack = vi.fn();
    const onSpecialKey = vi.fn();
    const element = await renderHeader({
      isMobile: true,
      showBackButton: true,
      showSidebarToggle: true,
      sidebarCollapsed: true,
      onBack,
      onSpecialKey,
    });

    const backButton = element.querySelector<HTMLButtonElement>(
      '[data-testid="session-back-button"]'
    );
    expect(backButton).toBeTruthy();
    expect(backButton?.getAttribute('aria-label')).toBe('Back');
    expect(backButton?.querySelector('svg')).toBeTruthy();

    // Sidebar toggle and chat toggle are hidden on mobile (menu covers them)
    const sidebarButton = element.querySelector<HTMLButtonElement>(
      '[data-testid="session-sidebar-toggle"]'
    );
    const chatButton = element.querySelector<HTMLButtonElement>(
      '[data-testid="chat-mode-toggle-button-compact"]'
    );
    expect(sidebarButton?.classList.contains('hidden')).toBe(true);
    expect(chatButton?.classList.contains('hidden')).toBe(true);

    // Navigation keys render compact and forward their key
    for (const [id, key] of [
      ['header-page-up-button', 'page_up'],
      ['header-page-down-button', 'page_down'],
      ['header-arrow-up-button', 'arrow_up'],
      ['header-arrow-down-button', 'arrow_down'],
      ['header-arrow-left-button', 'arrow_left'],
      ['header-arrow-right-button', 'arrow_right'],
    ] as const) {
      const button = element.querySelector<HTMLButtonElement>(`#${id}`);
      expect(button).toBeTruthy();
      expect(button?.classList.contains('w-8')).toBe(true);
      button?.click();
      expect(onSpecialKey).toHaveBeenLastCalledWith(key);
    }

    backButton?.click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('sends 1/2 answers from the header answer buttons', async () => {
    const onSendText = vi.fn();
    const element = await renderHeader({ isMobile: true, onSendText });

    element.querySelector<HTMLButtonElement>('#header-answer-1-button')?.click();
    expect(onSendText).toHaveBeenLastCalledWith('1');
    element.querySelector<HTMLButtonElement>('#header-answer-2-button')?.click();
    expect(onSendText).toHaveBeenLastCalledWith('2');
  });

  it('keeps the desktop back label and responsive sizing classes', async () => {
    const element = await renderHeader({ isMobile: false, showBackButton: true });
    const backButton = element.querySelector<HTMLButtonElement>(
      '[data-testid="session-back-button"]'
    );

    expect(backButton?.textContent?.trim()).toBe('Back');
    expect(backButton?.classList.contains('md:w-auto')).toBe(true);
    expect(backButton?.classList.contains('md:h-auto')).toBe(true);
  });

  it('hides workspace info on mobile and shows the priority action buttons', async () => {
    const sessionName =
      'Issue 516 iPhone session title that is intentionally very long to verify truncation';
    const element = await renderHeader({ isMobile: true, sessionName });
    const titleContainer = element.querySelector<HTMLElement>(
      '[data-testid="session-title-container"]'
    );

    expect(titleContainer).toBeTruthy();
    expect(titleContainer?.classList.contains('hidden')).toBe(true);
    expect(element.querySelector('#header-quick-keys-button')).toBeTruthy();
    expect(element.querySelector('#header-keyboard-button')).toBeTruthy();
    expect(element.querySelector('#header-page-up-button')).toBeTruthy();
    expect(element.querySelector('#header-page-down-button')).toBeTruthy();
    expect(element.querySelector('#header-rerender-button')).toBeTruthy();
    expect(element.querySelector('#header-clipboard-button')).toBeNull();
  });
});
