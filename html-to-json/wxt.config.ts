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
        suggested_key: { default: 'Alt+Shift+T' },
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
