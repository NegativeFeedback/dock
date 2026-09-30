import { describe, test, expect } from 'bun:test';
import { normalizeTag, matchesTagFilter, normalizeColor, tagGroupDescriptor, compareTagNames, tagHex, TAG_COLORS, MAX_TAG_LENGTH, type Tag } from '../src/lib/utils/tags-core';

describe('normalizeTag', () => {
	test('trims and collapses whitespace', () => {
		expect(normalizeTag('  home   cloud ')).toBe('home cloud');
	});
	test('allows letters, digits and _ - . /', () => {
		expect(normalizeTag('web/proxy')).toBe('web/proxy');
		expect(normalizeTag('v2.0_beta-1')).toBe('v2.0_beta-1');
	});
	test('rejects empty / non-string', () => {
		expect(normalizeTag('')).toBeNull();
		expect(normalizeTag('   ')).toBeNull();
		expect(normalizeTag(null)).toBeNull();
		expect(normalizeTag(42)).toBeNull();
	});
	test('rejects illegal characters', () => {
		for (const bad of ['a,b', 'a;b', 'a:b', 'a=b', 'a`b', 'a$b', 'a\tb'.replace('\t', '')]) {
			expect(normalizeTag(bad)).toBeNull();
		}
	});
	test('rejects an over-long tag', () => {
		expect(normalizeTag('a'.repeat(MAX_TAG_LENGTH + 1))).toBeNull();
		expect(normalizeTag('a'.repeat(MAX_TAG_LENGTH))).toBe('a'.repeat(MAX_TAG_LENGTH));
	});
});

describe('tagGroupDescriptor', () => {
	const mk = (id: number, name: string, color = 'blue', icon: string | null = null): Tag => ({ id, name, color, icon });

	test('untagged -> null (falls into the Untagged bucket)', () => {
		expect(tagGroupDescriptor([])).toBeNull();
	});
	test('single tag: key=id, label=name, colour from that tag', () => {
		const d = tagGroupDescriptor([mk(5, 'prod', 'red')]);
		expect(d).toMatchObject({ key: '5', label: 'prod', color: tagHex('red') });
	});
	test('combination: sorted-id key, label in name order', () => {
		// deliberately unsorted input
		const d = tagGroupDescriptor([mk(9, 'infra'), mk(3, 'prod'), mk(12, 'Db')]);
		expect(d?.key).toBe('3+9+12');
		expect(d?.label).toBe('Db + infra + prod');
	});
	test('colour + icons follow name order', () => {
		const d = tagGroupDescriptor([mk(3, 'prod', 'red', 'lock'), mk(9, 'infra', 'green', 'wrench')]);
		expect(d?.color).toBe(tagHex('green'));       // "infra" sorts first
		expect(d?.icons).toEqual(['wrench', 'lock']);
	});
	test('key ignores input order and names', () => {
		const a = tagGroupDescriptor([mk(2, 'b'), mk(10, 'a')])!;
		const b = tagGroupDescriptor([mk(10, 'a'), mk(2, 'b')])!;
		expect(a.key).toBe('2+10');
		expect(b.key).toBe('2+10');
	});
	test('order weight: fewer tags first, independent of ids', () => {
		const one = tagGroupDescriptor([mk(2, 'a')])!;
		const oneHigher = tagGroupDescriptor([mk(7, 'b')])!;
		const two = tagGroupDescriptor([mk(1, 'a'), mk(2, 'b')])!;
		expect(one.order).toBe(oneHigher.order); // same size -> label decides (groupData)
		expect(oneHigher.order).toBeLessThan(two.order);
	});
});

describe('compareTagNames', () => {
	const mk = (id: number, name: string): Tag => ({ id, name, color: 'blue', icon: null });
	test('case-insensitive alphabetical', () => {
		const names = [mk(1, 'zeta'), mk(2, 'IOT'), mk(3, 'dev'), mk(4, 'Alpha')].sort(compareTagNames).map((t) => t.name);
		expect(names).toEqual(['Alpha', 'dev', 'IOT', 'zeta']);
	});
	test('ties broken by id', () => {
		expect(compareTagNames(mk(5, 'Prod'), mk(2, 'prod'))).toBeGreaterThan(0);
		expect(compareTagNames(mk(2, 'prod'), mk(5, 'Prod'))).toBeLessThan(0);
	});
});

describe('matchesTagFilter', () => {
	test('empty filter matches everything', () => {
		expect(matchesTagFilter([], [])).toBe(true);
		expect(matchesTagFilter(undefined, [])).toBe(true);
		expect(matchesTagFilter([1], [])).toBe(true);
	});
	test('ALL mode (default): item must carry every selected tag id', () => {
		expect(matchesTagFilter([1, 2], [1])).toBe(true);
		expect(matchesTagFilter([1, 2], [1, 2])).toBe(true);
		expect(matchesTagFilter([1], [1, 2])).toBe(false);
		expect(matchesTagFilter([1], [1, 2], 'all')).toBe(false);
	});
	test('ANY mode: item must carry at least one selected tag id', () => {
		expect(matchesTagFilter([1], [1, 2], 'any')).toBe(true);
		expect(matchesTagFilter([3], [1, 2], 'any')).toBe(false);
		expect(matchesTagFilter([2, 3], [1, 2], 'any')).toBe(true);
	});
	test('untagged item with a non-empty filter never matches', () => {
		expect(matchesTagFilter([], [1])).toBe(false);
		expect(matchesTagFilter(undefined, [1])).toBe(false);
	});
});

describe('normalizeColor', () => {
	test('accepts palette colours', () => {
		for (const c of TAG_COLORS) expect(normalizeColor(c)).toBe(c);
	});
	test('defaults unknown/invalid to slate', () => {
		expect(normalizeColor('mauve')).toBe('slate');
		expect(normalizeColor(null)).toBe('slate');
		expect(normalizeColor(42)).toBe('slate');
	});
});
