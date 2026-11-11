# New Tab Follows Container

A Firefox extension: Ctrl/Cmd+T and the + button open the new tab in the
container of the tab you were on.

- New blank tabs follow the container of the last tab you looked at in that
  window.
- If that tab had no container, the new tab goes to the fallback container
  chosen in the extension's options (default: no container, so the tab is left
  alone).
- Tabs that arrive with a URL (links, other apps, session restore) and private
  windows are never touched.

## Permissions

- `tabs`, `cookies`, `contextualIdentities`: read which container a tab is in
  and open the new tab in that container.
- `storage`: remember the fallback container.

The extension collects no data and makes no network requests.

## Build

    npx web-ext lint --ignore-files dist
    npx web-ext build --ignore-files dist

## License

MIT
