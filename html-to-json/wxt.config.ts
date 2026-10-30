import { defineConfig } from 'wxt';

export default defineConfig({
  outDir: 'dist',
  manifest: ({ browser }) => ({
    name: 'Table Export',
    description: 'Pick a table on any web page and export it as JSON, XML, CSV, TSV, or clean HTML.',
    permissions: ['activeTab', 'scripting', 'storage', 'downloads'],
    // Requested per site, only when a page embeds tables in cross-origin iframes.
    optional_host_permissions: ['*://*/*'],
    action: { default_title: 'Pick a table to export' },
    commands: {
      _execute_action: {
        // Option combos are unreliable on macOS: the Option key types characters on many
        // layouts (e.g. U.S. International – PC), so the browser never sees Alt+Shift+T.
        suggested_key: { default: 'Alt+Shift+T', mac: 'MacCtrl+Shift+T' },
        description: 'Pick a table to export',
      },
    },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'table-export@ohdoubleseven.se',
          strict_min_version: '140.0',
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),
});
