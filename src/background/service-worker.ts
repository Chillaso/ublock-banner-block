import { getRules, saveRules } from '../utils/storage';

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    const rules = await getRules();

    if (rules.length === 0) {
      await saveRules([]);
    }
  })().catch((error) => {
    console.error('Failed to initialize extension storage.', error);
  });
});
