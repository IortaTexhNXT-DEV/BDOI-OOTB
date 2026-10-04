/**
 * Pure helpers over the menu tree (components/SideBar/list.js): which entry the current address belongs to, and the
 * flat list of screens the menu search looks through.
 */

/** Key of an entry: the names from the top-level group down to it, e.g. "Operations/Renewals/Renewal Queue". */
export const keyOf = (names) => names.join("/");

// Addresses carry record numbers (/agent/clientview/123); the menu includes are written without them.
const strip = (pathname) => String(pathname || "").replace(/\d+/g, "");

/**
 * How well an entry matches an address: the length of its longest matching include (0 when none matches). The home
 * route "/" matches only itself, so the Executive Dashboard does not claim every address.
 */
export const matchLength = (item, pathname) => {
  const raw = String(pathname || "");
  const path = strip(raw);
  let best = 0;
  for (const inc of [item?.path, ...(item?.includes || [])]) {
    if (!inc) continue;
    if (inc === "/") {
      if (raw === "/" && best < 1) best = 1;
      continue;
    }
    if ((path.startsWith(inc) || raw.startsWith(inc)) && inc.length > best) best = inc.length;
  }
  return best;
};

/** Every screen of the menu with the names of the groups (and sections) above it. */
export const flattenLeaves = (items, ancestors = []) =>
  (items || []).flatMap((item) =>
    item.submenu ? flattenLeaves(item.submenu, [...ancestors, item]) : [{ item, ancestors }],
  );

/**
 * The entry the address belongs to (the most specific match), as the list of names from its top-level group down to
 * it; [] when the address is not a menu screen.
 */
export const findActiveTrail = (items, pathname) => {
  let best = null;
  let bestLen = 0;
  for (const leaf of flattenLeaves(items)) {
    const len = matchLength(leaf.item, pathname);
    if (len > bestLen) {
      best = leaf;
      bestLen = len;
    }
  }
  return best ? [...best.ancestors.map((a) => a.name), best.item.name] : [];
};

/**
 * Menu search: screens whose label, full name or group path contains the text, best matches first (label starting
 * with the text, then label containing it, then a group name containing it).
 * @param {Function} label translated label of an entry name
 */
export const searchMenu = (items, query, label, limit = 12) => {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  return flattenLeaves(items)
    .filter((leaf) => leaf.item.path)
    .map((leaf) => {
      const text = label(leaf.item.name).toLowerCase();
      const name = leaf.item.name.toLowerCase();
      const groups = leaf.ancestors.map((a) => label(a.name).toLowerCase()).join(" ");
      let rank = 0;
      if (text.startsWith(q) || name.startsWith(q)) rank = 3;
      else if (text.includes(q) || name.includes(q)) rank = 2;
      else if (groups.includes(q)) rank = 1;
      return { ...leaf, rank };
    })
    .filter((leaf) => leaf.rank > 0)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit);
};
