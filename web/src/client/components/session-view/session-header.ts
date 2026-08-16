/**
 * Session Header Component
 *
 * Header bar for session view with navigation, session info, status, and controls.
 * Includes back button, sidebar toggle, session details, and terminal controls.
 */
import { html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Session } from '../../../shared/types.js';
import '../clickable-path.js';
import '../inline-edit.js';
import '../notification-status.js';
import '../keyboard-capture-indicator.js';
import '../git-status-badge.js';
import { authClient } from '../../services/auth-client.js';
import { isAIAssistantSession, sendAIPrompt } from '../../utils/ai-sessions.js';
import { createLogger } from '../../utils/logger.js';
import './compact-menu.js';
import '../theme-toggle-icon.js';
import './image-upload-menu.js';
import './session-status-dropdown.js';

const logger = createLogger('session-header');

@customElement('session-header')
export class SessionHeader extends LitElement {
  // Disable shadow DOM to use Tailwind
  createRenderRoot() {
    return this;
  }

  @property({ type: Object }) session: Session | null = null;
  @property({ type: Boolean }) showBackButton = true;
  @property({ type: Boolean }) showSidebarToggle = false;
  @property({ type: Boolean }) sidebarCollapsed = false;
  @property({ type: Number }) terminalMaxCols = 0;
  @property({ type: Number }) terminalFontSize = 14;
  @property({ type: String }) customWidth = '';
  @property({ type: Boolean }) showWidthSelector = false;
  @property({ type: String }) widthLabel = '';
  @property({ type: String }) widthTooltip = '';
  @property({ type: Function }) onBack?: () => void;
  @property({ type: Function }) onSidebarToggle?: () => void;
  @property({ type: Function }) onOpenFileBrowser?: () => void;
  @property({ type: Function }) onCreateSession?: () => void;
  @property({ type: Function }) onOpenImagePicker?: () => void;
  @property({ type: Function }) onMaxWidthToggle?: () => void;
  @property({ type: Function }) onWidthSelect?: (width: number) => void;
  @property({ type: Function }) onFontSizeChange?: (size: number) => void;
  @property({ type: Function }) onOpenSettings?: () => void;
  @property({ type: String }) currentTheme = 'system';
  @property({ type: Boolean }) keyboardCaptureActive = true;
  @property({ type: Boolean }) isMobile = false;
  @property({ type: Boolean }) macAppConnected = false;
  @property({ type: Function }) onTerminateSession?: () => void;
  @property({ type: Function }) onClearSession?: () => void;
  @property({ type: Boolean }) hasGitRepo = false;
  @property({ type: String }) viewMode: 'terminal' | 'worktree' = 'terminal';
  @property({ type: Function }) onToggleViewMode?: () => void;
  @property({ type: Boolean }) chatMode = false;
  @property({ type: Function }) onToggleChatMode?: () => void;
  @property({ type: Function }) onShowKeyboard?: () => void;
  @property({ type: Function }) onShowQuickKeys?: () => void;
  @property({ type: Function }) onPasteClipboard?: () => void;
  @property({ type: Function }) onSpecialKey?: (key: string) => void;
  @property({ type: Function }) onSendText?: (text: string) => void;
  @state() private isHovered = false;
  @state() private useCompactMenu = false;
  private resizeObserver?: ResizeObserver;

  connectedCallback() {
    super.connectedCallback();
    // Load saved theme preference
    const saved = localStorage.getItem('vibetunnel-theme');
    this.currentTheme = (saved as 'light' | 'dark' | 'system') || 'system';

    // Setup resize observer for responsive button switching
    this.setupResizeObserver();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);
  }

  private setupResizeObserver() {
    // Observe the header container for size changes
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.checkButtonSpace(entry.contentRect.width);
      }
    });

    // Start observing after the element is rendered
    this.updateComplete.then(() => {
      // Use requestAnimationFrame to ensure DOM is fully rendered
      requestAnimationFrame(() => {
        const headerContainer = this.querySelector('.session-header-container');
        if (headerContainer) {
          this.resizeObserver?.observe(headerContainer);
          // Trigger initial check
          const width = headerContainer.clientWidth;
          this.checkButtonSpace(width);
        }
      });
    });
  }

  private checkButtonSpace(containerWidth: number) {
    // Calculate the minimum space needed for all individual buttons
    // Button widths (including padding):
    const imageUploadButton = 40;
    const themeToggleButton = 40;
    const settingsButton = 40;
    const widthSelectorButton = 120; // Wider due to text content (increased)
    const statusDropdownButton = 120; // Wider due to text content (increased)
    const buttonGap = 8;

    // Other elements:
    const captureIndicatorWidth = 100; // Keyboard capture indicator (increased)
    const sessionInfoMinWidth = 300; // Minimum space for session name/path (increased)
    const sidebarToggleWidth = this.showSidebarToggle && this.sidebarCollapsed ? 56 : 0; // Including gap
    const padding = 48; // Container padding (increased)

    // Calculate total required width
    const buttonsWidth =
      imageUploadButton +
      themeToggleButton +
      settingsButton +
      widthSelectorButton +
      statusDropdownButton +
      buttonGap * 4;

    const requiredWidth =
      sessionInfoMinWidth + sidebarToggleWidth + captureIndicatorWidth + buttonsWidth + padding;

    // Switch to compact menu more aggressively (larger buffer)
    const buffer = 150; // Increased buffer to account for sidebar
    const shouldUseCompact = containerWidth < requiredWidth + buffer;

    if (shouldUseCompact !== this.useCompactMenu) {
      this.useCompactMenu = shouldUseCompact;
      this.requestUpdate();
    }
  }

  private getStatusText(): string {
    if (!this.session) return '';
    if ('active' in this.session && this.session.active === false) {
      return 'waiting';
    }
    return this.session.status;
  }

  private getStatusDotColor(): string {
    if (!this.session) return 'bg-bg-muted';
    if ('active' in this.session && this.session.active === false) {
      return 'bg-bg-muted';
    }
    return this.session.status === 'running' ? 'bg-status-success' : 'bg-status-warning';
  }

  render() {
    if (!this.session) return null;

    return html`
      <style>
        .session-header-container {
          --vt-header-padding-left: max(1rem, env(safe-area-inset-left));
          --vt-header-padding-right: max(1rem, env(safe-area-inset-right));
          padding-left: var(--vt-header-padding-left);
          padding-right: var(--vt-header-padding-right);
        }

        @media (max-width: 480px) {
          .session-header-container {
            --vt-header-padding-left: max(0.5rem, env(safe-area-inset-left));
            --vt-header-padding-right: max(0.5rem, env(safe-area-inset-right));
          }
        }
      </style>
      <!-- Header content -->
      <div
        class="flex items-center justify-between border-b border-border text-sm min-w-0 max-w-[100vw] bg-bg-secondary py-2 session-header-container"
      >
        <div class="flex items-center gap-2 sm:gap-3 overflow-hidden ${this.isMobile ? 'flex-none' : 'min-w-0 flex-1 flex-shrink'}">
          <!-- Sidebar Toggle (when sidebar is collapsed) - visible on all screen sizes -->
          ${
            this.showSidebarToggle && this.sidebarCollapsed
              ? html`
                <button
                  class="bg-bg-tertiary border border-border rounded-md w-11 h-11 p-0 md:w-auto md:h-auto md:p-2 text-primary transition-all duration-200 hover:bg-surface-hover hover:border-primary items-center justify-center flex-shrink-0 ${this.isMobile ? 'hidden' : 'flex'}"
                  @click=${() => this.onSidebarToggle?.()}
                  title="Show sidebar (⌘B)"
                  aria-label="Show sidebar"
                  aria-expanded="false"
                  aria-controls="sidebar"
                  data-testid="session-sidebar-toggle"
                >
                  <!-- Right chevron icon to expand sidebar -->
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/>
                  </svg>
                </button>
                
                <!-- Go to Root button (desktop only) -->
                <button
                  class="hidden sm:flex bg-bg-tertiary border border-border text-primary rounded-md p-2 transition-all duration-200 hover:bg-surface-hover hover:border-primary flex-shrink-0"
                  @click=${() => {
                    window.location.href = '/';
                  }}
                  title="Go to root"
                  data-testid="go-to-root-button"
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <!-- Four small rounded rectangles icon -->
                    <rect x="3" y="3" width="6" height="6" rx="1.5" ry="1.5"/>
                    <rect x="11" y="3" width="6" height="6" rx="1.5" ry="1.5"/>
                    <rect x="3" y="11" width="6" height="6" rx="1.5" ry="1.5"/>
                    <rect x="11" y="11" width="6" height="6" rx="1.5" ry="1.5"/>
                  </svg>
                </button>
                
                <!-- Create Session button (desktop only) -->
                <button
                  class="hidden sm:flex bg-bg-tertiary border border-border text-primary rounded-md p-2 transition-all duration-200 hover:bg-surface-hover hover:border-primary flex-shrink-0"
                  @click=${() => this.onCreateSession?.()}
                  title="Create New Session (⌘K)"
                  data-testid="create-session-button"
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
                  </svg>
                </button>
              `
              : ''
          }
          
          <!-- Status dot - visible on mobile, after sidebar toggle -->
          <div class="sm:hidden relative flex-shrink-0">
            <div class="w-2.5 h-2.5 rounded-full ${this.getStatusDotColor()}"></div>
            ${
              this.getStatusText() === 'running'
                ? html`<div class="absolute inset-0 w-2.5 h-2.5 rounded-full bg-status-success animate-ping opacity-50"></div>`
                : ''
            }
          </div>
          ${
            this.showBackButton
              ? html`
                <button
                  class="bg-bg-tertiary border border-border rounded-md w-8 h-10 p-0 md:w-auto md:h-auto md:px-3 md:py-1.5 flex items-center justify-center font-mono text-xs text-primary transition-all duration-200 hover:bg-surface-hover hover:border-primary flex-shrink-0"
                  @click=${() => this.onBack?.()}
                  aria-label="Back"
                  data-testid="session-back-button"
                >
                  ${
                    this.isMobile
                      ? html`
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M12.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L8.414 10l4.293 4.293a1 1 0 010 1.414z"/>
                        </svg>
                      `
                      : 'Back'
                  }
                </button>
              `
              : ''
          }
          <div
            class="text-primary min-w-0 flex-1 overflow-hidden ${this.isMobile ? 'hidden' : ''}"
            data-testid="session-title-container"
          >
            <div class="text-bright font-medium text-xs sm:text-sm min-w-0 overflow-hidden">
              <div class="flex items-center gap-1 min-w-0 overflow-hidden" @mouseenter=${this.handleMouseEnter} @mouseleave=${this.handleMouseLeave}>
                <inline-edit
                  class="min-w-0 overflow-hidden block max-w-xs sm:max-w-md"
                  .value=${
                    this.session.name ||
                    (Array.isArray(this.session.command)
                      ? this.session.command.join(' ')
                      : this.session.command)
                  }
                  .placeholder=${
                    Array.isArray(this.session.command)
                      ? this.session.command.join(' ')
                      : this.session.command
                  }
                  .onSave=${(newName: string) => this.handleRename(newName)}
                ></inline-edit>
                ${
                  isAIAssistantSession(this.session)
                    ? html`
                      <button
                        class="bg-transparent border-0 p-0 cursor-pointer transition-opacity duration-200 text-primary magic-button flex-shrink-0 ${this.isHovered ? 'opacity-50 hover:opacity-100' : 'opacity-0'} ml-1"
                        @click=${(e: Event) => {
                          e.stopPropagation();
                          this.handleMagicButton();
                        }}
                        title="Send prompt to update terminal title"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <!-- Wand -->
                          <path d="M9.5 21.5L21.5 9.5a1 1 0 000-1.414l-1.086-1.086a1 1 0 00-1.414 0L7 19l2.5 2.5z" opacity="0.9"/>
                          <path d="M6 18l-1.5 3.5a.5.5 0 00.7.7L8.5 21l-2.5-3z" opacity="0.9"/>
                          <!-- Sparkles/Rays -->
                          <circle cx="8" cy="4" r="1"/>
                          <circle cx="4" cy="8" r="1"/>
                          <circle cx="16" cy="4" r="1"/>
                          <circle cx="20" cy="8" r="1"/>
                          <circle cx="12" cy="2" r=".5"/>
                          <circle cx="2" cy="12" r=".5"/>
                          <circle cx="22" cy="12" r=".5"/>
                          <circle cx="18" cy="2" r=".5"/>
                        </svg>
                      </button>
                      <style>
                        /* Always show magic button on touch devices */
                        @media (hover: none) and (pointer: coarse) {
                          .magic-button {
                            opacity: 0.5 !important;
                          }
                          .magic-button:hover {
                            opacity: 1 !important;
                          }
                        }
                      </style>
                    `
                    : ''
                }
              </div>
            </div>
            <div
              class="text-xs opacity-75 mt-0.5 hidden sm:flex items-center gap-2 min-w-0 overflow-hidden"
              data-testid="session-details"
            >
              <clickable-path
                class="min-w-0 flex-1 truncate"
                .path=${this.session.workingDir}
                .iconSize=${12}
              ></clickable-path>
              ${
                this.session.gitRepoPath
                  ? html`
                    <git-status-badge
                      class="min-w-0 max-w-[30%] sm:max-w-none"
                      .session=${this.session}
                      .detailed=${false}
                    ></git-status-badge>
                  `
                  : ''
              }
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1 sm:gap-2 text-xs ${this.isMobile ? 'min-w-0 flex-1 justify-end' : 'flex-shrink-0'} ml-1 sm:ml-2">
          <!-- Keyboard capture indicator (always visible) -->
          <keyboard-capture-indicator
            .active=${this.keyboardCaptureActive}
            .isMobile=${this.isMobile}
            @capture-toggled=${(e: CustomEvent) => {
              this.dispatchEvent(
                new CustomEvent('capture-toggled', {
                  detail: e.detail,
                  bubbles: true,
                  composed: true,
                })
              );
            }}
          ></keyboard-capture-indicator>
          
          <!-- Responsive button container -->
          ${
            this.useCompactMenu || this.isMobile
              ? html`
              <!-- Compact menu for tight spaces or mobile -->
              <div class="flex items-center gap-0.5 sm:gap-2 ${this.isMobile ? 'min-w-0' : 'flex-shrink-0'}">
                ${
                  this.isMobile
                    ? html`
                      <div class="header-scroll-row flex items-center gap-0.5 overflow-x-auto min-w-0">
                      <!-- Quick keys toggle button (no native keyboard) -->
                      <button
                        class="bg-bg-tertiary border border-border rounded-md w-8 h-10 p-0 text-primary transition-all duration-200 hover:bg-surface-hover hover:border-primary flex items-center justify-center flex-shrink-0"
                        @click=${(e: Event) => {
                          e.stopPropagation();
                          this.onShowQuickKeys?.();
                        }}
                        title="Toggle quick keys"
                        aria-label="Toggle quick keys"
                        id="header-quick-keys-button"
                        data-testid="header-quick-keys-button"
                      >
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M3 6a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V6zm5.5 0a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1V6zM14 6a1 1 0 011-1h1a1 1 0 011 1v2a1 1 0 01-1 1h-1a1 1 0 01-1-1V6zM3 12a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" clip-rule="evenodd"/>
                        </svg>
                      </button>

                      <!-- Native keyboard button -->
                      <button
                        class="bg-bg-tertiary border border-border rounded-md w-8 h-10 p-0 text-primary transition-all duration-200 hover:bg-surface-hover hover:border-primary flex items-center justify-center flex-shrink-0"
                        @pointerdown=${(e: PointerEvent) => {
                          // Must run synchronously in the gesture and must not let the
                          // click bubble to session-view (it would steal focus and make
                          // iOS immediately close the keyboard we just opened).
                          e.preventDefault();
                          e.stopPropagation();
                          this.onShowKeyboard?.();
                        }}
                        @click=${(e: Event) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        title="Show native keyboard"
                        aria-label="Show native keyboard"
                        id="header-keyboard-button"
                        data-testid="header-keyboard-button"
                      >
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm2 0h12v8H4V5zm1 1.5h1.5V8H5V6.5zm3 0h1.5V8H8V6.5zm3 0h1.5V8H11V6.5zm3 0H15.5V8H14V6.5zM5 9h1.5v1.5H5V9zm3 0h1.5v1.5H8V9zm3 0h1.5v1.5H11V9zm3 0h1.5v1.5H14V9zm-7.5 2.25h7V12.5h-7v-1.25z" clip-rule="evenodd"/>
                        </svg>
                      </button>

                      <!-- Quick answer buttons for numbered prompts (Claude: 1=yes, 2=no) -->
                      ${(
                        [
                          {
                            id: 'answer-1',
                            title: 'Answer 1 (yes)',
                            text: '1',
                            color: 'text-status-success',
                          },
                          {
                            id: 'answer-2',
                            title: 'Answer 2 (no)',
                            text: '2',
                            color: 'text-status-warning',
                          },
                        ] as const
                      ).map(
                        (answer) => html`
                          <button
                            class="bg-bg-tertiary border border-border rounded-md w-8 h-10 p-0 ${answer.color} transition-all duration-200 hover:bg-surface-hover hover:border-primary flex items-center justify-center flex-shrink-0 font-mono text-sm font-bold"
                            @click=${(e: Event) => {
                              e.stopPropagation();
                              this.onSendText?.(answer.text);
                            }}
                            title="${answer.title}"
                            aria-label="${answer.title}"
                            id="header-${answer.id}-button"
                            data-testid="header-${answer.id}-button"
                          >
                            ${answer.text}
                          </button>
                        `
                      )}

                      <!-- Terminal navigation keys -->
                      ${(
                        [
                          { id: 'page-up', title: 'Page up', key: 'page_up', glyph: '⇞' },
                          { id: 'page-down', title: 'Page down', key: 'page_down', glyph: '⇟' },
                          { id: 'arrow-up', title: 'Arrow up', key: 'arrow_up', glyph: '↑' },
                          { id: 'arrow-down', title: 'Arrow down', key: 'arrow_down', glyph: '↓' },
                          { id: 'arrow-left', title: 'Arrow left', key: 'arrow_left', glyph: '←' },
                          {
                            id: 'arrow-right',
                            title: 'Arrow right',
                            key: 'arrow_right',
                            glyph: '→',
                          },
                        ] as const
                      ).map(
                        (navKey) => html`
                          <button
                            class="bg-bg-tertiary border border-border rounded-md w-8 h-10 p-0 text-primary transition-all duration-200 hover:bg-surface-hover hover:border-primary flex items-center justify-center flex-shrink-0 font-mono text-sm"
                            @click=${(e: Event) => {
                              e.stopPropagation();
                              this.onSpecialKey?.(navKey.key);
                            }}
                            title="${navKey.title}"
                            aria-label="${navKey.title}"
                            id="header-${navKey.id}-button"
                            data-testid="header-${navKey.id}-button"
                          >
                            ${navKey.glyph}
                          </button>
                        `
                      )}

                      <!-- Re-render (reload page) button -->
                      <button
                        class="bg-bg-tertiary border border-border rounded-md w-8 h-10 p-0 text-primary transition-all duration-200 hover:bg-surface-hover hover:border-primary flex items-center justify-center flex-shrink-0"
                        @click=${(e: Event) => {
                          e.stopPropagation();
                          window.location.reload();
                        }}
                        title="Re-render (reload page)"
                        aria-label="Re-render (reload page)"
                        id="header-rerender-button"
                        data-testid="header-rerender-button"
                      >
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
                        </svg>
                      </button>
                      </div>
                    `
                    : ''
                }
                <!-- Chat mode toggle button (in the overflow menu on mobile) -->
                <button
                  class="bg-bg-tertiary border border-border rounded-md w-11 h-11 p-0 md:w-auto md:h-auto md:p-2 text-primary transition-all duration-200 hover:bg-surface-hover hover:border-primary items-center justify-center flex-shrink-0 ${this.chatMode ? 'bg-primary text-white border-primary' : ''} ${this.isMobile ? 'hidden' : 'flex'}"
                  @click=${() => this.onToggleChatMode?.()}
                  title="${this.chatMode ? 'Switch to Terminal Mode' : 'Switch to Chat Mode'}"
                  aria-label="${this.chatMode ? 'Switch to Terminal Mode' : 'Switch to Chat Mode'}"
                  data-testid="chat-mode-toggle-button-compact"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2.678 11.894a1 1 0 01.287.801 10.97 10.97 0 01-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 01.71-.074A8.06 8.06 0 008 14c3.996 0 7-2.807 7-6 0-3.192-3.004-6-7-6S1 4.808 1 8c0 1.468.617 2.83 1.678 3.894zm-.493 3.905a21.682 21.682 0 01-.713.129c-.2.032-.352-.176-.273-.362a9.68 9.68 0 00.244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9.06 9.06 0 01-2.347-.306c-.52.263-1.639.742-3.468 1.105z"/>
                  </svg>
                </button>
                <compact-menu
                  .session=${this.session}
                  .onPasteClipboard=${this.onPasteClipboard}
                  .onSessionList=${this.onBack}
                  .widthLabel=${this.widthLabel}
                  .widthTooltip=${this.widthTooltip}
                  .onOpenFileBrowser=${this.onOpenFileBrowser}
                  .onUploadImage=${() => this.handleMobileUploadImage()}
                  .onMaxWidthToggle=${this.onMaxWidthToggle}
                  .onOpenSettings=${this.onOpenSettings}
                  .onCreateSession=${this.onCreateSession}
                  .currentTheme=${this.currentTheme}
                  .macAppConnected=${this.macAppConnected}
                  .onTerminateSession=${this.onTerminateSession}
                  .onClearSession=${this.onClearSession}
                  .hasGitRepo=${this.hasGitRepo}
                  .viewMode=${this.viewMode}
                  .onToggleViewMode=${() => this.dispatchEvent(new CustomEvent('toggle-view-mode'))}
                  .chatMode=${this.chatMode}
                  .onToggleChatMode=${this.onToggleChatMode}
                  @theme-changed=${(e: CustomEvent) => {
                    this.currentTheme = e.detail.theme;
                  }}
                ></compact-menu>
              </div>
            `
              : html`
              <!-- Individual buttons for larger screens -->
              <div class="flex items-center gap-2">
                <!-- Git worktree toggle button (visible when session has Git repo) -->
                ${
                  this.hasGitRepo
                    ? html`
                      <button
                        class="bg-bg-tertiary border border-border rounded-md p-2 text-primary transition-all duration-200 hover:bg-surface-hover hover:border-primary flex-shrink-0"
                        @click=${() => this.onToggleViewMode?.()}
                        title="${this.viewMode === 'terminal' ? 'Show Worktrees' : 'Show Terminal'}"
                        data-testid="worktree-toggle-button"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783z"/>
                        </svg>
                  </button>
                    `
                    : ''
                }

                <!-- Chat mode toggle button -->
                <button
                  class="bg-bg-tertiary border border-border rounded-md p-2 text-primary transition-all duration-200 hover:bg-surface-hover hover:border-primary flex-shrink-0 ${this.chatMode ? 'bg-primary text-white border-primary' : ''}"
                  @click=${() => this.onToggleChatMode?.()}
                  title="${this.chatMode ? 'Switch to Terminal Mode' : 'Switch to Chat Mode'}"
                  data-testid="chat-mode-toggle-button"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2.678 11.894a1 1 0 01.287.801 10.97 10.97 0 01-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 01.71-.074A8.06 8.06 0 008 14c3.996 0 7-2.807 7-6 0-3.192-3.004-6-7-6S1 4.808 1 8c0 1.468.617 2.83 1.678 3.894zm-.493 3.905a21.682 21.682 0 01-.713.129c-.2.032-.352-.176-.273-.362a9.68 9.68 0 00.244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9.06 9.06 0 01-2.347-.306c-.52.263-1.639.742-3.468 1.105z"/>
                  </svg>
                </button>

                <!-- Status dropdown -->
                <session-status-dropdown
                  .session=${this.session}
                  .onTerminate=${this.onTerminateSession}
                  .onClear=${this.onClearSession}
                ></session-status-dropdown>
                
                <!-- Image Upload Menu -->
                <image-upload-menu
                  .onPasteImage=${() => this.handlePasteImage()}
                  .onSelectImage=${() => this.handleSelectImage()}
                  .onOpenCamera=${() => this.handleOpenCamera()}
                  .onBrowseFiles=${() => this.onOpenFileBrowser?.()}
                  .isMobile=${this.isMobile}
                ></image-upload-menu>
                
                <!-- Theme toggle -->
                <theme-toggle-icon
                  .theme=${this.currentTheme}
                  @theme-changed=${(e: CustomEvent) => {
                    this.currentTheme = e.detail.theme;
                  }}
                ></theme-toggle-icon>
                
                <!-- Settings button -->
                <notification-status
                  @open-settings=${() => this.onOpenSettings?.()}
                ></notification-status>
                
                
                <!-- Terminal size button -->
                <button
                  class="bg-bg-tertiary border border-border rounded-lg px-3 py-2 font-mono text-xs text-text-muted transition-all duration-200 hover:text-primary hover:bg-surface-hover hover:border-primary hover:shadow-sm flex-shrink-0 width-selector-button"
                  @click=${() => this.onMaxWidthToggle?.()}
                  title="${this.widthTooltip}"
                >
                  ${this.widthLabel}
                </button>
              </div>
            `
          }
        </div>
      </div>
    `;
  }

  private handleRename(newName: string) {
    if (!this.session) return;

    // Dispatch event to parent component to handle the rename
    this.dispatchEvent(
      new CustomEvent('session-rename', {
        detail: {
          sessionId: this.session.id,
          newName: newName,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleMagicButton() {
    if (!this.session) return;

    logger.log('Magic button clicked for session', this.session.id);

    sendAIPrompt(this.session.id, authClient).catch((error) => {
      logger.error('Failed to send AI prompt', error);
    });
  }

  private handleMouseEnter = () => {
    this.isHovered = true;
  };

  private handleMouseLeave = () => {
    this.isHovered = false;
  };

  private handlePasteImage() {
    // Dispatch event to session-view to handle paste
    this.dispatchEvent(
      new CustomEvent('paste-image', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleSelectImage() {
    // Always dispatch select-image event to trigger the OS picker directly
    this.dispatchEvent(
      new CustomEvent('select-image', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleOpenCamera() {
    // Dispatch event to session-view to open camera
    this.dispatchEvent(
      new CustomEvent('open-camera', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleMobileUploadImage() {
    // Directly trigger the OS image picker
    this.dispatchEvent(
      new CustomEvent('select-image', {
        bubbles: true,
        composed: true,
      })
    );
  }
}
