import './popup.css';

import type { Rule } from '../types/rule';
import { addRule, getRuleById, getRules, removeRule, updateRule } from '../utils/storage';
import { matchesBaseUrl } from '../utils/url-match';

const START_PICKER_MESSAGE_TYPE = 'UBLOCK_BANNER_BLOCK_START_PICKER';
const PICK_RESULT_STORAGE_KEY = 'pendingPickSelector';

const form = document.querySelector<HTMLFormElement>('#rule-form');
const baseUrlInput = document.querySelector<HTMLInputElement>('#base-url');
const selectorsInput = document.querySelector<HTMLTextAreaElement>('#selectors');
const pickElementButton = document.querySelector<HTMLButtonElement>('#pick-element-button');
const submitButton = document.querySelector<HTMLButtonElement>('#submit-button');
const cancelEditButton = document.querySelector<HTMLButtonElement>('#cancel-edit-button');
const statusElement = document.querySelector<HTMLParagraphElement>('#status');
const ruleListElement = document.querySelector<HTMLUListElement>('#rule-list');
const emptyStateElement = document.querySelector<HTMLDivElement>('#empty-state');
const pickerResultElement = document.querySelector<HTMLParagraphElement>('#picker-result');
const ruleFormTitle = document.querySelector<HTMLHeadingElement>('#rule-form-title');

let editingRuleId: string | null = null;

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

const setPickerResult = (message: string, state: 'existing' | 'draft'): void => {
  if (!pickerResultElement) {
    return;
  }

  pickerResultElement.hidden = false;
  pickerResultElement.textContent = message;
  pickerResultElement.dataset.state = state;
};

const clearPickerResult = (): void => {
  if (!pickerResultElement) {
    return;
  }

  pickerResultElement.hidden = true;
  pickerResultElement.textContent = '';
  delete pickerResultElement.dataset.state;
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

const setFormFields = (baseUrl: string, selectors: string): void => {
  if (baseUrlInput) {
    baseUrlInput.value = baseUrl;
  }

  if (selectorsInput) {
    selectorsInput.value = selectors;
  }
};

const clearFormFields = (): void => {
  setFormFields('', '');
};

const getActiveTabUrl = async (): Promise<string | null> => {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    return activeTab?.url ?? null;
  } catch (error) {
    console.error('Failed to read the active tab URL.', error);
    return null;
  }
};

const appendSelectorValue = (currentValue: string, selector: string): string => {
  if (!currentValue.trim()) {
    return selector;
  }

  const selectors = currentValue
    .split(/[\n,]/g)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (selectors.includes(selector)) {
    return currentValue;
  }

  return `${currentValue.trim()},\n${selector}`;
};

const getBestMatchingRule = (pageUrl: string, rules: Rule[]): Rule | null => {
  const matchingRules = rules.filter((rule) => matchesBaseUrl(pageUrl, rule.baseUrl));

  if (matchingRules.length === 0) {
    return null;
  }

  matchingRules.sort((leftRule, rightRule) => rightRule.baseUrl.length - leftRule.baseUrl.length);

  return matchingRules[0] ?? null;
};

const beginEditingRule = (rule: Rule): void => {
  if (!baseUrlInput || !selectorsInput) {
    return;
  }

  editingRuleId = rule.id;
  setFormFields(rule.baseUrl, rule.selectors);

  if (ruleFormTitle) {
    ruleFormTitle.textContent = 'Edit rule';
  }

  if (submitButton) {
    submitButton.textContent = 'Update rule';
  }

  if (cancelEditButton) {
    cancelEditButton.hidden = false;
  }
};

const consumePickedSelector = async (): Promise<void> => {
  if (!selectorsInput) {
    return;
  }

  try {
    const stored = (await chrome.storage.local.get(PICK_RESULT_STORAGE_KEY)) as {
      pendingPickSelector?: unknown;
    };
    const pendingSelector = stored.pendingPickSelector;

    if (typeof pendingSelector !== 'string' || !pendingSelector.trim()) {
      return;
    }

    const activeTabUrl = await getActiveTabUrl();

    if (activeTabUrl && !editingRuleId) {
      const existingRule = getBestMatchingRule(activeTabUrl, await getRules());

      if (existingRule) {
        const nextSelectors = appendSelectorValue(existingRule.selectors, pendingSelector.trim());
        const hasChangedRule = nextSelectors !== existingRule.selectors;
        const nextRule = {
          ...existingRule,
          selectors: nextSelectors,
        };

        if (hasChangedRule) {
          const hasUpdatedRule = await updateRule(nextRule);

          if (!hasUpdatedRule) {
            setStatus('Unable to update the existing rule with the picked selector.', 'error');
            return;
          }
        }

        beginEditingRule(nextRule);
        await chrome.storage.local.remove(PICK_RESULT_STORAGE_KEY);
        await renderRules();
        setPickerResult('Updated existing rule', 'existing');

        if (hasChangedRule) {
          setStatus('Picked selector was saved directly into the existing rule.');
        } else {
          setStatus('The picked selector is already part of the existing rule.');
        }

        selectorsInput.focus();
        return;
      }
    }

    selectorsInput.value = appendSelectorValue(selectorsInput.value, pendingSelector.trim());
    await chrome.storage.local.remove(PICK_RESULT_STORAGE_KEY);
    setPickerResult('Ready as new rule', 'draft');

    if (editingRuleId) {
      setStatus('Picked selector added to the existing rule. Review it and update the rule.');
    } else {
      setStatus('Picked selector added. Review it and save the rule.');
    }

    selectorsInput.focus();
  } catch (error) {
    console.error('Failed to read the picked selector.', error);
  }
};

const handlePickElement = async (): Promise<void> => {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!activeTab?.id || !activeTab.url) {
      setStatus('Open a regular webpage before using the picker.', 'error');
      return;
    }

    const url = new URL(activeTab.url);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      setStatus('Element picker is unavailable on this page.', 'error');
      return;
    }

    await chrome.storage.local.remove(PICK_RESULT_STORAGE_KEY);

    const response = (await chrome.tabs.sendMessage(activeTab.id, {
      type: START_PICKER_MESSAGE_TYPE,
    })) as { ok?: boolean; error?: string } | undefined;

    if (response?.ok === false) {
      setStatus(response.error ?? 'Unable to activate the picker on this page.', 'error');
      return;
    }

    setStatus('Picker active on the page. Click an element, then reopen the popup.');
    window.setTimeout(() => {
      window.close();
    }, 120);
  } catch (error) {
    console.error('Failed to start the element picker.', error);
    setStatus('Unable to activate the picker on this page.', 'error');
  }
};

const populateBaseUrlFromActiveTab = async (): Promise<void> => {
  if (!baseUrlInput || baseUrlInput.value.trim() || editingRuleId) {
    return;
  }

  try {
    const activeTabUrl = await getActiveTabUrl();
    const suggestedBaseUrl = activeTabUrl ? getSuggestedBaseUrl(activeTabUrl) : null;

    if (suggestedBaseUrl) {
      baseUrlInput.value = suggestedBaseUrl;
    }
  } catch {}
};

const resetFormState = (): void => {
  editingRuleId = null;
  clearFormFields();
  clearPickerResult();

  if (ruleFormTitle) {
    ruleFormTitle.textContent = 'Add rule';
  }

  if (submitButton) {
    submitButton.textContent = 'Save rule';
  }

  if (cancelEditButton) {
    cancelEditButton.hidden = true;
  }

  void populateBaseUrlFromActiveTab();
};

const startEditingRule = async (ruleId: string): Promise<void> => {
  if (!baseUrlInput || !selectorsInput) {
    return;
  }

  const rule = await getRuleById(ruleId);

  if (!rule) {
    setStatus('The selected rule is no longer available.', 'error');
    if (editingRuleId === ruleId) {
      resetFormState();
    }
    await renderRules();
    return;
  }

  beginEditingRule(rule);
  clearPickerResult();

  setStatus('Editing rule. Update the fields and save your changes.');
  baseUrlInput.focus();
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
    const urlElement = document.createElement('p');
    const actionsElement = document.createElement('div');
    const metaElement = document.createElement('p');
    const editButton = document.createElement('button');
    const deleteButton = document.createElement('button');

    listItem.className = 'rule-item';
    urlElement.className = 'rule-url';
    actionsElement.className = 'rule-actions';
    metaElement.className = 'rule-meta';
    editButton.className = 'edit-button';
    editButton.type = 'button';
    editButton.textContent = 'Edit';
    editButton.setAttribute('aria-label', `Edit rule for ${rule.baseUrl}`);
    deleteButton.className = 'delete-button';
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.setAttribute('aria-label', `Delete rule for ${rule.baseUrl}`);

    urlElement.textContent = rule.baseUrl;
    metaElement.textContent = toSelectorPreview(rule.selectors);
    listItem.append(urlElement);

    editButton.addEventListener('click', () => {
      void startEditingRule(rule.id);
    });

    deleteButton.addEventListener('click', async () => {
      try {
        await removeRule(rule.id);

        if (editingRuleId === rule.id) {
          resetFormState();
        }

        setStatus('Rule removed.');
        await renderRules();
      } catch (error) {
        console.error('Failed to remove the rule.', error);
        setStatus('Unable to remove the rule.', 'error');
      }
    });

    actionsElement.append(editButton, deleteButton);
    listItem.append(actionsElement, metaElement);
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

  const normalizedRule: Rule = {
    id: editingRuleId ?? crypto.randomUUID(),
    baseUrl: normalizeBaseUrl(baseUrlInput.value),
    selectors: selectorsInput.value.trim(),
  };

  try {
    if (editingRuleId) {
      const hasUpdatedRule = await updateRule(normalizedRule);

      if (!hasUpdatedRule) {
        setStatus('The selected rule is no longer available.', 'error');
        resetFormState();
        await renderRules();
        return;
      }

      setStatus('Rule updated.');
    } else {
      await addRule(normalizedRule);
      setStatus('Rule saved.');
    }

    resetFormState();
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

if (cancelEditButton) {
  cancelEditButton.addEventListener('click', () => {
    resetFormState();
    setStatus('Edit cancelled.');
  });
}

if (pickElementButton) {
  pickElementButton.addEventListener('click', () => {
    void handlePickElement();
  });
}

void populateBaseUrlFromActiveTab();
void consumePickedSelector();

void renderRules().catch((error) => {
  console.error('Failed to render rules.', error);
  setStatus('Unable to load saved rules.', 'error');
});