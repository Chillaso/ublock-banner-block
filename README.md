# uBlock Banner Block

uBlock Banner Block is a Manifest V3 browser extension built with Vite and TypeScript. It removes anti-adblock overlays on configured sites and restores page scrolling after those elements are removed.

The extension ships with a small set of built-in rules and also lets you add custom rules from the popup. Rules are stored in `chrome.storage.sync`, so they follow the browser profile where the extension is installed.

## What it does

- Loads a content script on pages and applies cleanup only when the current URL matches a configured base URL.
- Removes DOM elements that match one or more CSS selectors.
- Restores page scrolling when a site locks `html` or `body` overflow.
- Lets you add, remove, and review rules from the popup UI.
- Includes built-in rules from `src/config/preconfigured-rules.yaml`.

## Project structure

- `manifest.config.ts`: source manifest used by `@crxjs/vite-plugin`.
- `src/background/service-worker.ts`: initializes extension storage on install.
- `src/content/index.ts`: applies matching rules on each page.
- `src/content/observer.ts`: removes matching elements and restores scrolling during DOM changes.
- `src/popup/`: popup UI for adding and removing rules.
- `src/utils/storage.ts`: merges built-in rules with user-defined rules from `chrome.storage.sync`.
- `src/config/preconfigured-rules.yaml`: bundled read-only rules.

## Requirements

- Node.js 18 or newer
- npm
- Chrome or another Chromium-based browser that supports Manifest V3 extensions

## Install dependencies

```bash
npm install
```

## Build

Create a production build of the extension:

```bash
npm run build
```

The build output is written to `dist/` and includes the generated `manifest.json` and compiled extension assets.

## Development workflow

Run a local development server:

```bash
npm run dev
```

Rebuild automatically when source files change:

```bash
npm run watch
```

For local browser installation, use the unpacked extension from `dist/` after running a build.

## Permissions

- `storage`: saves built-in rule state and custom rules.
- `activeTab`: reads the current tab URL to suggest a base URL in the popup form.

## Installation

See [INSTRUCTIONS.md](./INSTRUCTIONS.md) for the step-by-step installation and reload process.