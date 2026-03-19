import type { Rule } from '../types/rule';
import { getPreconfiguredRules } from './preconfigured-rules.ts';

const DISABLED_BUILTIN_RULE_IDS_STORAGE_KEY = 'disabledBuiltinRuleIds';
const RULES_STORAGE_KEY = 'rules';

type RuleStorageShape = {
  [DISABLED_BUILTIN_RULE_IDS_STORAGE_KEY]?: string[];
  [RULES_STORAGE_KEY]?: Rule[];
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
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

const getStoredRules = async (): Promise<Rule[]> => {
  const stored = (await chrome.storage.sync.get(RULES_STORAGE_KEY)) as RuleStorageShape;

  return normalizeRules(stored[RULES_STORAGE_KEY]).map((rule) => ({
    id: rule.id,
    baseUrl: rule.baseUrl,
    selectors: rule.selectors,
  }));
};

const getDisabledBuiltinRuleIds = async (): Promise<string[]> => {
  const stored = (await chrome.storage.sync.get(DISABLED_BUILTIN_RULE_IDS_STORAGE_KEY)) as RuleStorageShape;

  return normalizeStringArray(stored[DISABLED_BUILTIN_RULE_IDS_STORAGE_KEY]);
};

const saveDisabledBuiltinRuleIds = async (ruleIds: string[]): Promise<void> => {
  await chrome.storage.sync.set({ [DISABLED_BUILTIN_RULE_IDS_STORAGE_KEY]: [...new Set(ruleIds)] });
};

const mergeRules = (storedRules: Rule[], disabledBuiltinRuleIds: string[]): Rule[] => {
  const disabledRuleIdSet = new Set(disabledBuiltinRuleIds);
  const builtinRules = getPreconfiguredRules().filter((rule) => !disabledRuleIdSet.has(rule.id));

  return [...builtinRules, ...storedRules];
};

export const getRules = async (): Promise<Rule[]> => {
  const [storedRules, disabledBuiltinRuleIds] = await Promise.all([getStoredRules(), getDisabledBuiltinRuleIds()]);

  return mergeRules(storedRules, disabledBuiltinRuleIds);
};

export const saveRules = async (rules: Rule[]): Promise<void> => {
  await chrome.storage.sync.set({ [RULES_STORAGE_KEY]: rules });
};

export const addRule = async (rule: Rule): Promise<void> => {
  const rules = await getStoredRules();

  await saveRules([
    ...rules,
    {
      id: rule.id,
      baseUrl: rule.baseUrl,
      selectors: rule.selectors,
    },
  ]);
};

export const removeRule = async (ruleId: string): Promise<void> => {
  const builtinRuleIds = new Set(getPreconfiguredRules().map((rule) => rule.id));

  if (builtinRuleIds.has(ruleId)) {
    const disabledBuiltinRuleIds = await getDisabledBuiltinRuleIds();

    await saveDisabledBuiltinRuleIds([...disabledBuiltinRuleIds, ruleId]);
    return;
  }

  const rules = await getStoredRules();
  const nextRules = rules.filter((rule) => rule.id !== ruleId);

  await saveRules(nextRules);
};

export const onRulesChanged = (listener: (rules: Rule[]) => void): void => {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (
      areaName !== 'sync' ||
      (!changes[RULES_STORAGE_KEY] && !changes[DISABLED_BUILTIN_RULE_IDS_STORAGE_KEY])
    ) {
      return;
    }

    const storedRules = changes[RULES_STORAGE_KEY]
      ? normalizeRules(changes[RULES_STORAGE_KEY].newValue)
      : undefined;
    const disabledBuiltinRuleIds = changes[DISABLED_BUILTIN_RULE_IDS_STORAGE_KEY]
      ? normalizeStringArray(changes[DISABLED_BUILTIN_RULE_IDS_STORAGE_KEY].newValue)
      : undefined;

    void Promise.all([
      storedRules ? Promise.resolve(storedRules) : getStoredRules(),
      disabledBuiltinRuleIds ? Promise.resolve(disabledBuiltinRuleIds) : getDisabledBuiltinRuleIds(),
    ]).then(([resolvedStoredRules, resolvedDisabledBuiltinRuleIds]) => {
      listener(mergeRules(resolvedStoredRules, resolvedDisabledBuiltinRuleIds));
    });
  });
};
