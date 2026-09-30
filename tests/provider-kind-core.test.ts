import { describe, expect, test } from 'bun:test';
import { providerKind, oidcProviderName } from '../src/lib/server/provider-kind-core';

/**
 * What a session's provider column means.
 *
 * It decides what the session reports itself as, and whether logging out also ends
 * the session at the identity provider - so a provider whose name is read wrong
 * quietly leaves the user signed in upstream.
 */

describe('the kind of account a session belongs to', () => {
	test('a named OIDC provider is an OIDC session', () => {
		expect(providerKind('oidc:Keycloak')).toBe('oidc');
	});

	test('a name containing colons is still one name', () => {
		// "oidc:" is a prefix, not a separator to split on.
		expect(providerKind('oidc:corp:eu:keycloak')).toBe('oidc');
	});

	test('a bare kind is that kind', () => {
		expect(providerKind('oidc')).toBe('oidc');
		expect(providerKind('ldap')).toBe('ldap');
		expect(providerKind('local')).toBe('local');
	});

	test('no provider at all is a local account', () => {
		expect(providerKind(null)).toBe('local');
		expect(providerKind(undefined)).toBe('local');
		expect(providerKind('')).toBe('local');
	});

	test('something nothing writes grants nothing extra', () => {
		expect(providerKind('saml')).toBe('local');
		expect(providerKind('oidcx')).toBe('local');
	});
});

describe('which provider should end the session', () => {
	test('the name after the prefix', () => {
		expect(oidcProviderName('oidc:Keycloak')).toBe('Keycloak');
		expect(oidcProviderName('oidc:corp:eu')).toBe('corp:eu');
	});

	test('a bare oidc names nobody, so logout stays local', () => {
		expect(oidcProviderName('oidc')).toBeNull();
		expect(oidcProviderName('oidc:')).toBeNull();
	});

	test('other kinds name nobody', () => {
		expect(oidcProviderName('ldap:AD')).toBeNull();
		expect(oidcProviderName('local')).toBeNull();
		expect(oidcProviderName(null)).toBeNull();
	});
});
