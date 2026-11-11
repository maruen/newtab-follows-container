// New Tab Follows Container
//
// A fresh empty tab (Ctrl/Cmd+T, the + button) is re-opened in the container of
// the tab that was active before it. If that tab had no container, the new tab
// goes to the fallback container chosen in the options page (none by default,
// which leaves such tabs alone). Tabs that arrive with a URL (links, external
// handlers, session restore) are left alone, so whatever opened them keeps
// deciding their container.

const FALLBACK_KEY = "fallbackContainer";
const NO_CONTAINER = "firefox-default";
const PRIVATE_PREFIX = "firefox-private";
const BLANK = new Set(["", "about:blank", "about:newtab", "about:home"]);
// How long a new tab may stay URL-less before we treat it as a real empty tab.
// Tabs opened with a URL get it within a few ms; this just absorbs the race.
const SETTLE_MS = 120;

// windowId -> cookieStoreId of the last tab the user looked at
const lastContainer = new Map();
// tab ids we created ourselves, so onCreated ignores them
const ownTabs = new Set();
// tab ids Firefox just created that we may still move; they must not
// overwrite the memory of where the user was when they become active
const pending = new Set();

// cookieStoreId of the fallback container, "" for none (see options.js)
let fallback = "";

function remember(tab) {
  if (!tab || tab.windowId === undefined) return;
  if (tab.cookieStoreId.startsWith(PRIVATE_PREFIX)) return;
  if (pending.has(tab.id)) return;
  lastContainer.set(tab.windowId, tab.cookieStoreId);
}

async function fallbackStoreId() {
  if (!fallback) return null;
  // the container may have been deleted since it was chosen
  try { return (await browser.contextualIdentities.get(fallback)).cookieStoreId; } catch (_) { return null; }
}

async function targetFor(windowId) {
  const last = lastContainer.get(windowId);
  if (last && last !== NO_CONTAINER) return last;
  return fallbackStoreId();
}

browser.tabs.onActivated.addListener(async ({ tabId }) => {
  try { remember(await browser.tabs.get(tabId)); } catch (_) {} // closed already
});

// A tab that was blank when activated (e.g. one we just created) gets a URL
// later; record its container then, so the next Ctrl+T follows it.
browser.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.url && tab.active) remember(tab);
}, { properties: ["url"] });

browser.tabs.onCreated.addListener((created) => {
  if (ownTabs.has(created.id)) { ownTabs.delete(created.id); return; }
  if (created.cookieStoreId !== NO_CONTAINER) return;       // already in a container
  if (created.openerTabId !== undefined) return;             // opened from a page: Firefox inherits
  if (!BLANK.has(created.url || "")) return;                 // came with a URL

  pending.add(created.id);
  setTimeout(async () => {
    try {
      let tab;
      try { tab = await browser.tabs.get(created.id); } catch (_) { return; } // closed already
      if (!BLANK.has(tab.url || "") || tab.cookieStoreId !== NO_CONTAINER) return;
      const target = await targetFor(tab.windowId);
      if (!target || target === NO_CONTAINER) return;
      const props = { windowId: tab.windowId, index: tab.index, active: tab.active, cookieStoreId: target };
      const fresh = await browser.tabs.create(props);
      ownTabs.add(fresh.id);
      await browser.tabs.remove(tab.id);
    } finally {
      pending.delete(created.id);
    }
  }, SETTLE_MS);
});

browser.storage.local.get(FALLBACK_KEY).then((stored) => { fallback = stored[FALLBACK_KEY] || ""; });
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[FALLBACK_KEY]) fallback = changes[FALLBACK_KEY].newValue || "";
});

// Seed memory with what is active right now.
browser.tabs.query({ active: true }).then((tabs) => tabs.forEach(remember));
