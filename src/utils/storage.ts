import type { Rule } from '../types/rule';
import { getPreconfiguredRules } from './preconfigured-rules.ts';

const DISABLED_BUILTIN_RULE_IDS_STORAGE_KEY = 'disabledBuiltinRuleIds';
const RULES_STORAGE_KEY = 'rules';
const builtinRuleIds = new Set(getPreconfiguredRules().map((rule) => rule.id));

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
  const mergedRules = new Map<string, Rule>();

  getPreconfiguredRules()
    .filter((rule) => !disabledRuleIdSet.has(rule.id))
    .forEach((rule) => {
      mergedRules.set(rule.id, rule);
    });

  storedRules.forEach((rule) => {
    mergedRules.set(rule.id, rule);
  });

  return [...mergedRules.values()];
};

export const getRules = async (): Promise<Rule[]> => {
  const [storedRules, disabledBuiltinRuleIds] = await Promise.all([getStoredRules(), getDisabledBuiltinRuleIds()]);

  return mergeRules(storedRules, disabledBuiltinRuleIds);
};

export const getRuleById = async (ruleId: string): Promise<Rule | null> => {
  const rules = await getRules();
  const rule = rules.find((entry) => entry.id === ruleId);

  if (!rule) {
    return null;
  }

  return rule;
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

export const updateRule = async (rule: Rule): Promise<boolean> => {
  const [rules, disabledBuiltinRuleIds] = await Promise.all([getStoredRules(), getDisabledBuiltinRuleIds()]);
  let hasUpdatedRule = false;

  const nextRules = rules.map((storedRule) => {
    if (storedRule.id !== rule.id) {
      return storedRule;
    }

    hasUpdatedRule = true;

    return {
      id: rule.id,
      baseUrl: rule.baseUrl,
      selectors: rule.selectors,
    };
  });

  if (builtinRuleIds.has(rule.id)) {
    const rulesToSave = hasUpdatedRule
      ? nextRules
      : [
          ...nextRules,
          {
            id: rule.id,
            baseUrl: rule.baseUrl,
            selectors: rule.selectors,
          },
        ];
    const nextDisabledBuiltinRuleIds = disabledBuiltinRuleIds.filter((disabledRuleId) => disabledRuleId !== rule.id);

    await Promise.all([saveRules(rulesToSave), saveDisabledBuiltinRuleIds(nextDisabledBuiltinRuleIds)]);

    return true;
  }

  if (!hasUpdatedRule) {
    return false;
  }

  await saveRules(nextRules);

  return true;
};

export const removeRule = async (ruleId: string): Promise<void> => {
  if (builtinRuleIds.has(ruleId)) {
    const [rules, disabledBuiltinRuleIds] = await Promise.all([getStoredRules(), getDisabledBuiltinRuleIds()]);
    const nextRules = rules.filter((rule) => rule.id !== ruleId);

    await Promise.all([
      saveRules(nextRules),
      saveDisabledBuiltinRuleIds([...disabledBuiltinRuleIds, ruleId]),
    ]);
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
