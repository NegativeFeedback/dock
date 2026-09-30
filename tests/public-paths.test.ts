import { describe, expect, test } from 'bun:test';
import {
	isPublicPath,
	PUBLIC_EXACT,
	PUBLIC_PREFIXES
} from '../src/lib/server/public-paths-core';

describe('an exact entry covers only itself', () => {
	test('the licence route is public', () => {
		expect(isPublicPath('/api/license')).toBe(true);
	});

	test('but nothing underneath it is', () => {
		// A route added beneath an exact entry starts out protected, so nobody publishes
		// one by accident.
		expect(isPublicPath('/api/license/export')).toBe(false);
		expect(isPublicPath('/api/license/keys')).toBe(false);
	});

	test('the same holds for every other exact entry', () => {
		for (const path of PUBLIC_EXACT) {
			expect(isPublicPath(path)).toBe(true);
			expect(isPublicPath(`${path}/anything`)).toBe(false);
		}
	});
});

describe('a prefix entry covers its subtree, which is the point of it', () => {
	test('the health probes include their database check', () => {
		expect(isPublicPath('/api/health')).toBe(true);
		expect(isPublicPath('/api/health/database')).toBe(true);
	});

	test('the OIDC dance spans several callbacks', () => {
		expect(isPublicPath('/api/auth/oidc')).toBe(true);
		expect(isPublicPath('/api/auth/oidc/callback')).toBe(true);
		expect(isPublicPath('/api/auth/oidc/1/initiate')).toBe(true);
	});

	test('the docs page loads its own viewer', () => {
		expect(isPublicPath('/api/docs')).toBe(true);
		expect(isPublicPath('/api/docs/ui')).toBe(true);
	});

	test('the prefix list stays short, because each entry opens a whole subtree', () => {
		expect(PUBLIC_PREFIXES.sort()).toEqual(['/api/auth/oidc', '/api/docs', '/api/health']);
	});
});

describe('routes that must never be public', () => {
	const mustBeProtected = [
		'/api/users',
		'/api/users/1',
		'/api/containers',
		'/api/environments',
		'/api/settings/general',
		'/api/hawser/connect',
		'/api/hawser/tokens',
		'/api/notifications/trigger-test',
		'/api/roles',
		'/api/audit',
		// A version-exact inventory says which published advisories apply here, and the
		// only screen that shows it is behind a login anyway.
		'/api/dependencies'
	];

	for (const path of mustBeProtected) {
		test(path, () => {
			expect(isPublicPath(path)).toBe(false);
		});
	}
});

describe('a near miss does not slip through', () => {
	test('a path that merely starts with an entry is not public', () => {
		// '/api/licenses' shares a prefix with '/api/license' but is a different route.
		expect(isPublicPath('/api/licenses')).toBe(false);
		expect(isPublicPath('/api/health-check')).toBe(false);
		expect(isPublicPath('/loginx')).toBe(false);
	});

	test('the webhook exceptions still match only their own shape', () => {
		expect(isPublicPath('/api/git/webhook/12')).toBe(true);
		expect(isPublicPath('/api/git/stacks/3/webhook')).toBe(true);
		expect(isPublicPath('/api/git/webhook/abc')).toBe(false);
		expect(isPublicPath('/api/git/webhook/12/extra')).toBe(false);
	});
});
