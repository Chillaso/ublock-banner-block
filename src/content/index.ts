import { clearOverflowOverride, runInitialCleanup, startObserver } from './observer';
import type { Rule } from '../types/rule';
import { getRules, onRulesChanged } from '../utils/storage';
import { matchesBaseUrl } from '../utils/url-match';

let activeObserver: MutationObserver | null = null;

const parseSelectors = (rules: Rule[]): string[] => {
  const selectors = rules.flatMap((rule) => {
    return rule.selectors
      .split(/[\n,]/g)
      .map((selector) => selector.trim())
      .filter(Boolean);
  });

  return [...new Set(selectors)];
};

const getMatchingRules = (rules: Rule[]): Rule[] => {
  return rules.filter((rule) => matchesBaseUrl(window.location.href, rule.baseUrl));
};

const stopObserver = (): void => {
  if (!activeObserver) {
    return;
  }

  activeObserver.disconnect();
  activeObserver = null;
};

const applyRules = (rules: Rule[]): void => {
  const matchingRules = getMatchingRules(rules);
  const selectors = parseSelectors(matchingRules);

  stopObserver();

  if (selectors.length === 0) {
    clearOverflowOverride();
    return;
  }

  runInitialCleanup(selectors);
  activeObserver = startObserver(selectors);
};

const initialize = async (): Promise<void> => {
  try {
    const rules = await getRules();

    applyRules(rules);
  } catch (error) {
    console.error('Failed to initialize banner blocking rules.', error);
  }
};

void initialize();

onRulesChanged((rules) => {
  applyRules(rules);
});
