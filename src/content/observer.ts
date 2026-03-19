const OVERFLOW_OVERRIDE_ATTRIBUTE = 'data-ublock-banner-block-overflow';

const restoreOverflowOnElement = (element: HTMLElement | null): void => {
  if (!element) {
    return;
  }

  const computedStyle = window.getComputedStyle(element);
  const isLocked = [computedStyle.overflow, computedStyle.overflowX, computedStyle.overflowY].some((value) => {
    return value === 'hidden' || value === 'clip';
  });

  const hasLockedInlineOverflow = [
    element.style.overflow,
    element.style.overflowX,
    element.style.overflowY,
  ].some((value) => value === 'hidden' || value === 'clip');

  if (!isLocked && !hasLockedInlineOverflow) {
    return;
  }

  element.style.removeProperty('overflow');
  element.style.removeProperty('overflow-x');
  element.style.removeProperty('overflow-y');

  if (isLocked) {
    element.style.setProperty('overflow', 'auto', 'important');
    element.style.setProperty('overflow-y', 'auto', 'important');
    element.setAttribute(OVERFLOW_OVERRIDE_ATTRIBUTE, 'true');
  }
};

export const clearOverflowOverride = (): void => {
  [document.documentElement, document.body].forEach((element) => {
    if (!element || !element.hasAttribute(OVERFLOW_OVERRIDE_ATTRIBUTE)) {
      return;
    }

    element.style.removeProperty('overflow');
    element.style.removeProperty('overflow-x');
    element.style.removeProperty('overflow-y');
    element.removeAttribute(OVERFLOW_OVERRIDE_ATTRIBUTE);
  });
};

export const restoreOverflow = (): void => {
  restoreOverflowOnElement(document.documentElement);
  restoreOverflowOnElement(document.body);
};

export const removeElements = (selectors: string[]): number => {
  let removedCount = 0;

  selectors.forEach((selector) => {
    try {
      const nodes = document.querySelectorAll(selector);

      nodes.forEach((node) => {
        node.remove();
        removedCount += 1;
      });
    } catch (error) {
      console.warn(`Skipping invalid selector: ${selector}`, error);
    }
  });

  return removedCount;
};

const runCleanupPass = (selectors: string[]): void => {
  removeElements(selectors);
  restoreOverflow();
};

export const startObserver = (selectors: string[]): MutationObserver => {
  const observer = new MutationObserver(() => {
    runCleanupPass(selectors);
  });

  const target = document.body ?? document.documentElement;

  observer.observe(target, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
  });

  return observer;
};

export const runInitialCleanup = (selectors: string[]): void => {
  runCleanupPass(selectors);
};
