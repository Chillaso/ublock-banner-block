import type { Rule } from '../types/rule';

const RULES_STORAGE_KEY = 'rules';

type RuleStorageShape = {
  [RULES_STORAGE_KEY]?: Rule[];
};

const normalizeRules = (value: unknown): Rule[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is Rule => {
    return Boolean(
      entry &&
        typeof entry === 'object' &&
        typeof (entry as Rule).id === 'string' &&
        typeof (entry as Rule).baseUrl === 'string' &&
        typeof (entry as Rule).selectors === 'string',
    );
  });
};

export const getRules = async (): Promise<Rule[]> => {
  const stored = (await chrome.storage.sync.get(RULES_STORAGE_KEY)) as RuleStorageShape;

  return normalizeRules(stored[RULES_STORAGE_KEY]);
};

export const saveRules = async (rules: Rule[]): Promise<void> => {
  await chrome.storage.sync.set({ [RULES_STORAGE_KEY]: rules });
};

export const addRule = async (rule: Rule): Promise<void> => {
  const rules = await getRules();

  await saveRules([...rules, rule]);
};

export const removeRule = async (ruleId: string): Promise<void> => {
  const rules = await getRules();
  const nextRules = rules.filter((rule) => rule.id !== ruleId);

  await saveRules(nextRules);
};

export const onRulesChanged = (listener: (rules: Rule[]) => void): void => {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes[RULES_STORAGE_KEY]) {
      return;
    }

    listener(normalizeRules(changes[RULES_STORAGE_KEY].newValue));
  });
};
