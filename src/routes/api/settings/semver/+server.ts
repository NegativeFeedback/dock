import { json, type RequestHandler } from '@sveltejs/kit';
import { getGlobalSemverConfig, setGlobalSemverConfig, type GlobalSemverConfig } from '$lib/server/db';
import { authorize } from '$lib/server/authorize';

/**
 * @openapi
 * summary: Get the global newer-version-tag (semver) detection config
 * resp-200: {enabled:boolean!, maxBump:string!, matchFlavor:boolean!, includePrerelease:boolean!}
 * resp-200-example: {"enabled":true,"maxBump":"minor","matchFlavor":true,"includePrerelease":false}
 * resp-403: Permission denied (needs settings:view)
 */
export const GET: RequestHandler = async ({ cookies }) => {
	// Describes how this installation is operated, and the settings screen is its only
	// reader - the update check and the scheduler read the config straight from the
	// database, so gating here costs nothing elsewhere.
	const auth = await authorize(cookies);
	if (auth.authEnabled && !await auth.can('settings', 'view')) {
		return json({ error: 'Permission denied' }, { status: 403 });
	}
	return json(await getGlobalSemverConfig());
};

const MAX_BUMPS = new Set(['patch', 'minor', 'major']);

/**
 * @openapi
 * summary: Set the global newer-version-tag (semver) detection config
 * body: {enabled:boolean, maxBump:string, matchFlavor:boolean, includePrerelease:boolean}
 * body-example: {"enabled":true,"maxBump":"minor","matchFlavor":true,"includePrerelease":false}
 * resp-200: {success:boolean!}
 * resp-403: Permission denied (needs settings:edit)
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const auth = await authorize(cookies);
	if (auth.authEnabled && !await auth.can('settings', 'edit')) {
		return json({ error: 'Permission denied' }, { status: 403 });
	}

	const data = await request.json().catch(() => ({}));
	const config: GlobalSemverConfig = {
		enabled: data.enabled === true,
		maxBump: MAX_BUMPS.has(data.maxBump) ? data.maxBump : 'major',
		matchFlavor: data.matchFlavor ?? true,
		includePrerelease: data.includePrerelease === true
	};
	await setGlobalSemverConfig(config);
	return json({ success: true });
};
