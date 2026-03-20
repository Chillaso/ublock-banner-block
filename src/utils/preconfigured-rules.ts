import { parse } from 'yaml';

import type { Rule } from '../types/rule';
import preconfiguredRulesRaw from '../config/preconfigured-rules.yaml?raw';

type YamlRule = {
  id?: unknown;
  baseUrl?: unknown;
  selectors?: unknown;
};

type YamlRuleFile = {
  rules?: YamlRule[];
};

const normalizeRule = (rule: YamlRule): Rule | null => {
  if (typeof rule.id !== 'string' || typeof rule.baseUrl !== 'string' || typeof rule.selectors !== 'string') {
    return null;
  }

  return {
    id: rule.id,
    baseUrl: rule.baseUrl,
    selectors: rule.selectors,
  };
};

const loadPreconfiguredRules = (): Rule[] => {
  try {
    const parsed = parse(preconfiguredRulesRaw) as YamlRuleFile;

    if (!Array.isArray(parsed.rules)) {
      return [];
    }

    return parsed.rules
      .map((rule) => normalizeRule(rule))
      .filter((rule): rule is Rule => rule !== null);
  } catch (error) {
    console.error('Failed to parse preconfigured rules YAML.', error);
    return [];
  }
};

const preconfiguredRules = loadPreconfiguredRules();

export const getPreconfiguredRules = (): Rule[] => {
  return preconfiguredRules;
};
