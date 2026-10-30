# Browser Tools

A collection of small browser extensions. Each one lives in its own directory and has its own README, dependencies and build.

## Extensions

| Extension | Directory | Browsers | What it does |
| --- | --- | --- | --- |
| **Table Export** | [`html-to-json/`](html-to-json/) | Chrome, Edge, Firefox 140+ | Pick a table on any page and export it as JSON, XML, CSV, TSV or clean HTML. You can copy it or download it. |

## Getting started

The extensions are built with [WXT](https://wxt.dev) and TypeScript, and use [pnpm](https://pnpm.io). To work on one, go into its directory:

```sh
cd html-to-json
pnpm install
pnpm test        # unit tests
pnpm dev         # Chrome with hot reload
pnpm build       # dist/{chrome,edge,firefox}-mv3
```

See the extension's README for how to load it in each browser, test it by hand, and package it for the stores.

## Adding an extension

1. Create a new top-level directory for it, with its own `package.json`.
2. Give it a `README.md` covering use, development and local testing.
3. Add a row to the table above.
