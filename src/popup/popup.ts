import './popup.css';

import type { Rule } from '../types/rule';
import { addRule, getRules, removeRule } from '../utils/storage';

const form = document.querySelector<HTMLFormElement>('#rule-form');
const baseUrlInput = document.querySelector<HTMLInputElement>('#base-url');
const selectorsInput = document.querySelector<HTMLTextAreaElement>('#selectors');
const statusElement = document.querySelector<HTMLParagraphElement>('#status');
const ruleListElement = document.querySelector<HTMLUListElement>('#rule-list');
const emptyStateElement = document.querySelector<HTMLDivElement>('#empty-state');

const toSelectorPreview = (selectors: string): string => {
  return selectors
    .split(/[\n,]/g)
    .map((selector) => selector.trim())
    .filter(Boolean)
    .join(' | ');
};

const setStatus = (message: string, state: 'idle' | 'error' = 'idle'): void => {
  if (!statusElement) {
    return;
  }

  statusElement.textContent = message;
  statusElement.dataset.state = state;
};

const normalizeBaseUrl = (input: string): string => {
  const url = new URL(input.trim());

  url.hash = '';
  url.search = '';

  return url.toString();
};

const getSuggestedBaseUrl = (input: string): string | null => {
  try {
    const url = new URL(input);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return `${url.origin}/`;
  } catch {
    return null;
  }
};

const populateBaseUrlFromActiveTab = async (): Promise<void> => {
  if (!baseUrlInput || baseUrlInput.value.trim()) {
    return;
  }

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const suggestedBaseUrl = activeTab?.url ? getSuggestedBaseUrl(activeTab.url) : null;

    if (suggestedBaseUrl) {
      baseUrlInput.value = suggestedBaseUrl;
    }
  } catch (error) {
    console.error('Failed to read the active tab URL.', error);
  }
};

const renderRules = async (): Promise<void> => {
  if (!ruleListElement || !emptyStateElement) {
    return;
  }

  const rules = await getRules();

  ruleListElement.innerHTML = '';
  emptyStateElement.hidden = rules.length !== 0;

  rules.forEach((rule) => {
    const listItem = document.createElement('li');
    const topLine = document.createElement('div');
    const titleGroup = document.createElement('div');
    const urlElement = document.createElement('p');
    const metaElement = document.createElement('p');
    const deleteButton = document.createElement('button');

    listItem.className = 'rule-item';
    topLine.className = 'rule-topline';
    titleGroup.className = 'rule-title-group';
    urlElement.className = 'rule-url';
    metaElement.className = 'rule-meta';
    deleteButton.className = 'delete-button';
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.setAttribute('aria-label', `Delete rule for ${rule.baseUrl}`);

    urlElement.textContent = rule.baseUrl;
    metaElement.textContent = toSelectorPreview(rule.selectors);
    titleGroup.append(urlElement);

    if (rule.isReadOnly) {
      const badgeElement = document.createElement('span');

      badgeElement.className = 'rule-badge';
      badgeElement.textContent = 'Built-in';
      badgeElement.setAttribute('aria-label', `Built-in rule for ${rule.baseUrl}`);
      titleGroup.append(badgeElement);
    }

    deleteButton.addEventListener('click', async () => {
      try {
        await removeRule(rule.id);
        setStatus('Rule removed.');
        await renderRules();
      } catch (error) {
        console.error('Failed to remove the rule.', error);
        setStatus('Unable to remove the rule.', 'error');
      }
    });

    topLine.append(titleGroup, deleteButton);
    listItem.append(topLine, metaElement);
    ruleListElement.append(listItem);
  });
};

const validateRule = (baseUrl: string, selectors: string): string | null => {
  if (!baseUrl.trim()) {
    return 'Enter a base URL.';
  }

  if (!selectors.trim()) {
    return 'Enter at least one CSS selector.';
  }

  try {
    const url = new URL(baseUrl);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return 'Only http and https URLs are supported.';
    }
  } catch {
    return 'Enter a valid URL, for example https://www.diariodejerez.es/';
  }

  return null;
};

const handleSubmit = async (event: SubmitEvent): Promise<void> => {
  event.preventDefault();

  if (!form || !baseUrlInput || !selectorsInput) {
    return;
  }

  const validationError = validateRule(baseUrlInput.value, selectorsInput.value);

  if (validationError) {
    setStatus(validationError, 'error');
    return;
  }

  const rule: Rule = {
    id: crypto.randomUUID(),
    baseUrl: normalizeBaseUrl(baseUrlInput.value),
    selectors: selectorsInput.value.trim(),
  };

  try {
    await addRule(rule);
    form.reset();
    setStatus('Rule saved.');
    await renderRules();
  } catch (error) {
    console.error('Failed to save the rule.', error);
    setStatus('Unable to save the rule.', 'error');
  }
};

if (form) {
  form.addEventListener('submit', (event) => {
    void handleSubmit(event);
  });
}

void populateBaseUrlFromActiveTab();

void renderRules().catch((error) => {
  console.error('Failed to render rules.', error);
  setStatus('Unable to load saved rules.', 'error');
});