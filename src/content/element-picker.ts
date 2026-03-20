const START_PICKER_MESSAGE_TYPE = 'UBLOCK_BANNER_BLOCK_START_PICKER';
const PICK_RESULT_STORAGE_KEY = 'pendingPickSelector';
const PICKER_OVERLAY_ATTRIBUTE = 'data-ublock-banner-block-picker-overlay';
const MAX_ANCESTOR_DEPTH = 15;
const MAX_DIRECT_CHILDREN = 8;
const MAX_SELECTOR_SEGMENTS = 5;
const PICKER_LAYER_Z_INDEX = '2147483647';
const UTILITY_CLASS_PATTERN = /^(active|current|selected|visible|hidden|show|open|close|closing|enter|leave|focus|focused|hover|loaded|loading|disabled|enabled)$/i;
const LAYOUT_TAGS = new Set(['BODY', 'HTML', 'MAIN', 'HEADER', 'FOOTER', 'NAV', 'ASIDE']);
const SELECTOR_HINT_PATTERN = /(modal|dialog|overlay|popup|backdrop|banner|consent|paywall|newsletter|subscribe|gate)/i;

type PickerResponse = {
  ok: boolean;
  error?: string;
};

let isPickerActive = false;
let hoveredElement: HTMLElement | null = null;
let hoverOverlay: HTMLDivElement | null = null;
let selectionOverlay: HTMLDivElement | null = null;
let noticeElement: HTMLDivElement | null = null;
let cleanupTimer: number | null = null;

const getEventElement = (target: EventTarget | null): HTMLElement | null => {
  if (!(target instanceof Element)) {
    return null;
  }

  return target instanceof HTMLElement ? target : target.closest<HTMLElement>('*');
};

const isSupportedPage = (): boolean => {
  return window.location.protocol === 'http:' || window.location.protocol === 'https:';
};

const clearCleanupTimer = (): void => {
  if (cleanupTimer === null) {
    return;
  }

  window.clearTimeout(cleanupTimer);
  cleanupTimer = null;
};

const setOverlayBounds = (overlay: HTMLDivElement | null, element: HTMLElement | null): void => {
  if (!overlay) {
    return;
  }

  if (!element) {
    overlay.hidden = true;
    return;
  }

  const rect = element.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) {
    overlay.hidden = true;
    return;
  }

  overlay.hidden = false;
  overlay.style.top = `${Math.max(rect.top, 0)}px`;
  overlay.style.left = `${Math.max(rect.left, 0)}px`;
  overlay.style.width = `${Math.max(rect.width, 0)}px`;
  overlay.style.height = `${Math.max(rect.height, 0)}px`;
};

const createOverlay = (borderColor: string, backgroundColor: string): HTMLDivElement => {
  const overlay = document.createElement('div');

  overlay.setAttribute(PICKER_OVERLAY_ATTRIBUTE, 'true');
  overlay.hidden = true;
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '0';
  overlay.style.height = '0';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = PICKER_LAYER_Z_INDEX;
  overlay.style.border = `2px solid ${borderColor}`;
  overlay.style.background = backgroundColor;
  overlay.style.borderRadius = '8px';
  overlay.style.boxShadow = `0 0 0 9999px rgba(15, 23, 42, 0.06), 0 0 0 1px ${borderColor}`;
  overlay.style.transition = 'all 80ms ease';

  return overlay;
};

const createNoticeElement = (): HTMLDivElement => {
  const element = document.createElement('div');

  element.setAttribute(PICKER_OVERLAY_ATTRIBUTE, 'true');
  element.style.position = 'fixed';
  element.style.top = '16px';
  element.style.right = '16px';
  element.style.maxWidth = '320px';
  element.style.padding = '10px 14px';
  element.style.borderRadius = '12px';
  element.style.background = 'rgba(15, 23, 42, 0.92)';
  element.style.color = '#f8fafc';
  element.style.font = '600 13px/1.4 Segoe UI, sans-serif';
  element.style.boxShadow = '0 14px 30px rgba(15, 23, 42, 0.28)';
  element.style.pointerEvents = 'none';
  element.style.zIndex = PICKER_LAYER_Z_INDEX;

  return element;
};

const ensurePickerUi = (): void => {
  if (!document.documentElement) {
    return;
  }

  if (!hoverOverlay) {
    hoverOverlay = createOverlay('#2563eb', 'rgba(37, 99, 235, 0.12)');
    document.documentElement.append(hoverOverlay);
  }

  if (!selectionOverlay) {
    selectionOverlay = createOverlay('#059669', 'rgba(5, 150, 105, 0.14)');
    document.documentElement.append(selectionOverlay);
  }

  if (!noticeElement) {
    noticeElement = createNoticeElement();
    document.documentElement.append(noticeElement);
  }
};

const updateNotice = (message: string): void => {
  ensurePickerUi();

  if (noticeElement) {
    noticeElement.textContent = message;
  }
};

const getDirectElementChildCount = (element: HTMLElement): number => {
  return [...element.children].filter((child) => child instanceof HTMLElement).length;
};

const parseAlphaChannel = (backgroundColor: string): number | null => {
  if (!backgroundColor || backgroundColor === 'transparent') {
    return null;
  }

  const rgbaMatch = backgroundColor.match(/rgba?\(([^)]+)\)/i);

  if (!rgbaMatch) {
    return backgroundColor.startsWith('rgb(') ? 1 : null;
  }

  const parts = rgbaMatch[1].split(',').map((part) => part.trim());

  if (parts.length < 4) {
    return 1;
  }

  const alpha = Number(parts[3]);

  return Number.isFinite(alpha) ? alpha : null;
};

const getSelectorHintScore = (element: HTMLElement): number => {
  const source = [element.id, ...element.classList, element.getAttribute('data-testid') ?? ''].join(' ');

  return SELECTOR_HINT_PATTERN.test(source) ? 2 : 0;
};

const getViewportCoverageScore = (element: HTMLElement, computedStyle: CSSStyleDeclaration): number => {
  const rect = element.getBoundingClientRect();
  const viewportWidth = Math.max(window.innerWidth, 1);
  const viewportHeight = Math.max(window.innerHeight, 1);
  const widthCoverage = rect.width / viewportWidth;
  const heightCoverage = rect.height / viewportHeight;

  if (computedStyle.position === 'fixed' && (widthCoverage >= 0.45 || heightCoverage >= 0.45)) {
    return 2;
  }

  if (computedStyle.position === 'absolute' && widthCoverage >= 0.5 && heightCoverage >= 0.5) {
    return 2;
  }

  return 0;
};

const scoreCandidate = (element: HTMLElement): number => {
  if (LAYOUT_TAGS.has(element.tagName)) {
    return -4;
  }

  const computedStyle = window.getComputedStyle(element);
  const directChildren = getDirectElementChildCount(element);
  let score = 0;

  if (computedStyle.position === 'fixed') {
    score += 3;
  }

  if (element.getAttribute('role') === 'dialog' || element.getAttribute('aria-modal') === 'true') {
    score += 3;
  }

  score += getViewportCoverageScore(element, computedStyle);

  if (computedStyle.position !== 'static') {
    const zIndex = Number.parseInt(computedStyle.zIndex, 10);

    if (Number.isFinite(zIndex) && zIndex > 50) {
      score += 1;
    }
  }

  const alpha = parseAlphaChannel(computedStyle.backgroundColor);

  if (alpha !== null && alpha > 0 && alpha < 1) {
    score += 1;
  }

  score += getSelectorHintScore(element);

  if (directChildren > MAX_DIRECT_CHILDREN) {
    score -= 2;
  }

  if (element.tagName === 'SECTION' || element.tagName === 'ARTICLE') {
    score -= 1;
  }

  return score;
};

const findComponentRoot = (element: HTMLElement): HTMLElement => {
  let current: HTMLElement | null = element;
  let depth = 0;
  const candidates: Array<{ element: HTMLElement; score: number; depth: number }> = [];

  while (current && depth < MAX_ANCESTOR_DEPTH) {
    if (current === document.body || current === document.documentElement) {
      break;
    }

    const score = scoreCandidate(current);

    if (score > 0) {
      candidates.push({ element: current, score, depth });
    }

    current = current.parentElement;
    depth += 1;
  }

  if (candidates.length === 0) {
    return element;
  }

  const highestScore = Math.max(...candidates.map((candidate) => candidate.score));
  const preferredCandidates = candidates.filter((candidate) => {
    return candidate.score >= Math.max(highestScore - 1, 2);
  });

  return preferredCandidates[preferredCandidates.length - 1]?.element ?? candidates[0].element;
};

const toStableClassNames = (element: HTMLElement): string[] => {
  return [...element.classList]
    .filter((className) => !UTILITY_CLASS_PATTERN.test(className))
    .filter((className) => !/^\d/.test(className))
    .filter((className) => className.length > 1 && className.length <= 40)
    .slice(0, 3);
};

const getAttributeSelector = (element: HTMLElement): string | null => {
  const stableAttributes = ['data-testid', 'data-test', 'data-qa', 'data-modal', 'data-dialog', 'aria-label'];

  for (const attributeName of stableAttributes) {
    const attributeValue = element.getAttribute(attributeName);

    if (!attributeValue || attributeValue.length > 80) {
      continue;
    }

    return `${element.tagName.toLowerCase()}[${attributeName}="${CSS.escape(attributeValue)}"]`;
  }

  return null;
};

const isUniqueSelector = (selector: string, target: HTMLElement): boolean => {
  try {
    const matches = document.querySelectorAll(selector);

    return matches.length === 1 && matches[0] === target;
  } catch {
    return false;
  }
};

const getElementIndex = (element: HTMLElement): number => {
  let index = 1;
  let sibling = element.previousElementSibling;

  while (sibling) {
    if (sibling.tagName === element.tagName) {
      index += 1;
    }

    sibling = sibling.previousElementSibling;
  }

  return index;
};

const getSegmentSelector = (element: HTMLElement): string => {
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const attributeSelector = getAttributeSelector(element);

  if (attributeSelector) {
    return attributeSelector;
  }

  const stableClasses = toStableClassNames(element);

  if (stableClasses.length > 0) {
    return `${element.tagName.toLowerCase()}.${stableClasses.map((className) => CSS.escape(className)).join('.')}`;
  }

  return `${element.tagName.toLowerCase()}:nth-of-type(${getElementIndex(element)})`;
};

const generateSelector = (element: HTMLElement): string => {
  const idSelector = element.id ? `#${CSS.escape(element.id)}` : null;

  if (idSelector && isUniqueSelector(idSelector, element)) {
    return idSelector;
  }

  const selfSelector = getSegmentSelector(element);

  if (isUniqueSelector(selfSelector, element)) {
    return selfSelector;
  }

  const segments = [selfSelector];
  let currentParent = element.parentElement;
  let remainingDepth = MAX_SELECTOR_SEGMENTS;

  while (currentParent && currentParent !== document.body && remainingDepth > 0) {
    const parentSegment = getSegmentSelector(currentParent);

    segments.unshift(parentSegment);

    const candidateSelector = segments.join(' > ');

    if (isUniqueSelector(candidateSelector, element)) {
      return candidateSelector;
    }

    if (parentSegment.startsWith('#')) {
      return candidateSelector;
    }

    currentParent = currentParent.parentElement;
    remainingDepth -= 1;
  }

  return segments.join(' > ');
};

const savePickedSelector = async (selector: string): Promise<void> => {
  await chrome.storage.local.set({ [PICK_RESULT_STORAGE_KEY]: selector });
};

const deactivatePicker = (): void => {
  if (!isPickerActive) {
    return;
  }

  clearCleanupTimer();
  isPickerActive = false;
  hoveredElement = null;

  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);
  window.removeEventListener('scroll', handleViewportChange, true);
  window.removeEventListener('resize', handleViewportChange, true);

  hoverOverlay?.remove();
  selectionOverlay?.remove();
  noticeElement?.remove();

  hoverOverlay = null;
  selectionOverlay = null;
  noticeElement = null;
};

const finishPicker = async (element: HTMLElement): Promise<void> => {
  const targetElement = findComponentRoot(element);
  const selector = generateSelector(targetElement);

  setOverlayBounds(hoverOverlay, null);
  setOverlayBounds(selectionOverlay, targetElement);
  updateNotice(`Selector ready: ${selector}. Reopen the extension popup to save it.`);

  await savePickedSelector(selector);

  clearCleanupTimer();
  cleanupTimer = window.setTimeout(() => {
    deactivatePicker();
  }, 900);
};

function handleViewportChange(): void {
  if (!isPickerActive) {
    return;
  }

  setOverlayBounds(hoverOverlay, hoveredElement);
}

function handleMouseMove(event: MouseEvent): void {
  if (!isPickerActive) {
    return;
  }

  const target = getEventElement(event.target);

  if (!target || target.hasAttribute(PICKER_OVERLAY_ATTRIBUTE)) {
    return;
  }

  hoveredElement = target;
  setOverlayBounds(hoverOverlay, target);
}

function handleKeyDown(event: KeyboardEvent): void {
  if (!isPickerActive || event.key !== 'Escape') {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  updateNotice('Picker cancelled.');

  clearCleanupTimer();
  cleanupTimer = window.setTimeout(() => {
    deactivatePicker();
  }, 200);
}

function handleClick(event: MouseEvent): void {
  if (!isPickerActive) {
    return;
  }

  const target = getEventElement(event.target);

  if (!target || target.hasAttribute(PICKER_OVERLAY_ATTRIBUTE)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  void finishPicker(target).catch((error) => {
    console.error('Failed to finish element picker.', error);
    updateNotice('Unable to capture a selector for this element.');
    clearCleanupTimer();
    cleanupTimer = window.setTimeout(() => {
      deactivatePicker();
    }, 600);
  });
}

export const activateElementPicker = async (): Promise<PickerResponse> => {
  if (!isSupportedPage()) {
    return {
      ok: false,
      error: 'Element picker is only available on regular web pages.',
    };
  }

  clearCleanupTimer();

  if (isPickerActive) {
    updateNotice('Picker is already active. Click an element or press Escape to cancel.');
    return { ok: true };
  }

  isPickerActive = true;
  hoveredElement = null;

  ensurePickerUi();
  updateNotice('Picker active. Hover any element, click to capture it, or press Escape to cancel.');
  setOverlayBounds(selectionOverlay, null);
  setOverlayBounds(hoverOverlay, null);

  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('scroll', handleViewportChange, true);
  window.addEventListener('resize', handleViewportChange, true);

  return { ok: true };
};

export const isStartPickerMessage = (message: unknown): boolean => {
  return Boolean(
    message &&
      typeof message === 'object' &&
      'type' in message &&
      (message as { type?: string }).type === START_PICKER_MESSAGE_TYPE,
  );
};