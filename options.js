// Options: which container a new tab falls back to when the previous tab had
// none. Stored as a cookieStoreId under FALLBACK_KEY, "" for no container;
// background.js picks changes up through storage.onChanged.

const FALLBACK_KEY = "fallbackContainer";
const select = document.getElementById("fallback");

function option(value, label) {
  const el = document.createElement("option");
  el.value = value;
  el.textContent = label;
  return el;
}

async function render() {
  const [identities, stored] = await Promise.all([
    browser.contextualIdentities.query({}),
    browser.storage.local.get(FALLBACK_KEY),
  ]);
  select.replaceChildren(option("", "No container"));
  for (const identity of identities) select.append(option(identity.cookieStoreId, identity.name));
  // a stored container that no longer exists shows as "No container"
  const current = stored[FALLBACK_KEY] || "";
  select.value = identities.some((identity) => identity.cookieStoreId === current) ? current : "";
}

select.addEventListener("change", () => {
  browser.storage.local.set({ [FALLBACK_KEY]: select.value });
});

// keep the list current while the page is open
browser.contextualIdentities.onCreated.addListener(render);
browser.contextualIdentities.onRemoved.addListener(render);
browser.contextualIdentities.onUpdated.addListener(render);

render();
