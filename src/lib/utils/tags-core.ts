/**
 * Pure helpers for user-defined container/stack tags. Distinct from
 * Docker labels - these are Dockhand's own organizational tags. No I/O so they are
 * unit-testable and shared by the API and the UI.
 */

/** Max length of a single tag. */
export const MAX_TAG_LENGTH = 32;

// A curated, vibrant tag palette: distinct, well-spaced hues (no near-duplicate
// grays or shades). Rendered via inline styles, so it needs no Tailwind class per
// colour. The stored value is the KEY; the UI looks up the hex here.
export const TAG_HEX: Record<string, string> = {
	slate: '#64748b',
	graphite: '#334155',
	ruby: '#e11d48',
	red: '#ef4444',
	coral: '#fb7185',
	orange: '#f97316',
	amber: '#f59e0b',
	gold: '#eab308',
	lime: '#84cc16',
	green: '#22c55e',
	emerald: '#10b981',
	forest: '#15803d',
	teal: '#14b8a6',
	cyan: '#06b6d4',
	sky: '#0ea5e9',
	blue: '#3b82f6',
	indigo: '#6366f1',
	royal: '#4338ca',
	violet: '#8b5cf6',
	purple: '#a855f7',
	grape: '#7e22ce',
	fuchsia: '#d946ef',
	magenta: '#c026d3',
	pink: '#ec4899'
};

/** All palette colour keys, in display order. */
export const TAG_COLORS = Object.keys(TAG_HEX);
export type TagColor = string;
export const DEFAULT_TAG_COLOR: TagColor = 'slate';

/** Coerce an arbitrary colour value to a palette colour, defaulting to slate. */
export function normalizeColor(raw: unknown): TagColor {
	return typeof raw === 'string' && raw in TAG_HEX ? raw : DEFAULT_TAG_COLOR;
}

/** The hex for a colour key (falls back to the default). */
export function tagHex(color: string): string {
	return TAG_HEX[color] ?? TAG_HEX[DEFAULT_TAG_COLOR];
}

/** A tag as stored/returned: catalog id, name, colour, and an optional lucide icon. */
export interface Tag {
	id: number;
	name: string;
	color: TagColor;
	icon?: string | null;
}

// A tag is a short human label: letters, digits, spaces, and `_ - . /` (so
// "home cloud", "web/proxy", "v2.0" all work). No control chars or other punctuation.
const TAG_CHARS = /^[A-Za-z0-9 _.\-/]+$/;

/**
 * Normalise a single tag: trim and collapse internal whitespace. Returns null if it
 * is empty or otherwise invalid (too long, illegal characters).
 */
export function normalizeTag(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const t = raw.trim().replace(/\s+/g, ' ');
	if (!t) return null;
	if (t.length > MAX_TAG_LENGTH) return null;
	if (!TAG_CHARS.test(t)) return null;
	return t;
}

export type TagFilterMode = 'all' | 'any';

/**
 * True if an item's tags satisfy the filter. `mode` 'all' requires every selected
 * tag id (AND); 'any' requires at least one (OR). An empty filter matches everything;
 * a non-empty filter never matches an untagged item.
 */
export function matchesTagFilter(
	itemTagIds: number[] | undefined,
	filterTagIds: number[],
	mode: TagFilterMode = 'all'
): boolean {
	if (!filterTagIds.length) return true;
	if (!itemTagIds?.length) return false;
	const have = new Set(itemTagIds);
	return mode === 'any'
		? filterTagIds.some((id) => have.has(id))
		: filterTagIds.every((id) => have.has(id));
}

/** Case-insensitive name order, tie-broken by id so it is total and stable. #1625 */
export function compareTagNames(a: Tag, b: Tag): number {
	return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id - b.id;
}

/**
 * Build a DataGrid group descriptor for an item's unique tag COMBINATION (used by
 * the containers/stacks "group by tag" mode). Returns null for an untagged item so
 * it falls into the trailing "Untagged" bucket. The key is the numerically sorted
 * tag ids joined with '+' (stable across renames, so collapsed state survives); the
 * label, colour and icons follow tag-name order. Order weight puts fewer-tag groups
 * first; groupData breaks ties by label, so groups read alphabetically.
 */
export function tagGroupDescriptor(tags: Tag[]): {
	key: string;
	label: string;
	color: string;
	icons: (string | null)[];
	order: number;
} | null {
	if (!tags.length) return null;
	const byName = tags.slice().sort(compareTagNames);
	return {
		key: tags.map((t) => t.id).sort((a, b) => a - b).join('+'),
		label: byName.map((t) => t.name).join(' + '),
		color: tagHex(byName[0].color),
		icons: byName.map((t) => t.icon ?? null),
		order: tags.length
	};
}
