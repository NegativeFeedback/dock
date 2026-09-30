import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listContainers, getContainerStats, EnvironmentNotFoundError } from '$lib/server/docker';
import { authorize } from '$lib/server/authorize';
import { hasEnvironments } from '$lib/server/db';
import type { ContainerStats } from '$lib/types';
import { calculateCpuPercent, calculateMemoryUsage, calculateMemoryLimit, calculateNetworkIO, calculateBlockIO } from '$lib/server/stats-calc-core';

// Helper to add timeout to promises
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
	]);
}

/**
 * GET /api/containers/stats - Get resource stats for all running containers
 *
 * @openapi
 * summary: Return a CPU/memory/network/block-IO stats snapshot for every running container in an environment (requires the 'view' permission)
 * description: Returns an empty array when no environment is configured or specified. With `debug=<name>` it returns the raw memory_stats for a single container instead. On internal error it returns an empty array with status 200.
 * query: env:integer! The target environment ID the container lives in (from GET /api/environments)
 * query: debug:string Return raw Docker stats for the single container with this name instead of the aggregate list
 * resp-200: Array of per-container stats snapshots (or, with `debug`, the raw stats for one container)
 * resp-403: Permission denied
 * resp-404: The requested debug container was not found
 */
export const GET: RequestHandler = async ({ url, cookies }) => {
	const auth = await authorize(cookies);

	const envId = url.searchParams.get('env');
	const envIdNum = envId ? parseInt(envId) : undefined;
	const debugContainer = url.searchParams.get('debug'); // Get raw stats for specific container

	// Permission check with environment context
	if (auth.authEnabled && !await auth.can('containers', 'view', envIdNum)) {
		return json({ error: 'Permission denied' }, { status: 403 });
	}

	// Early return if no environments configured (fresh install)
	if (!await hasEnvironments()) {
		return json([]);
	}

	// Early return if no environment specified
	if (!envIdNum) {
		return json([]);
	}

	try {
		// Get all running containers with timeout
		const containers = await withTimeout(
			listContainers(true, envIdNum),
			10000, // 10 second timeout
			[]
		);
		const runningContainers = containers.filter(c => c.state === 'running');

		// Debug mode: return raw stats for specific container
		if (debugContainer) {
			const container = runningContainers.find(c => c.name === debugContainer);
			if (container) {
				const rawStats = await getContainerStats(container.id, envIdNum);
				return json({
					name: container.name,
					memory_stats: (rawStats as any).memory_stats
				});
			}
			return json({ error: 'Container not found' }, { status: 404 });
		}

		// All at once, deliberately. The daemon samples CPU twice per call, so each
		// one costs about two seconds no matter what; anything narrower than "every
		// container" multiplies that into the caller's wait. The collection worker
		// paces its own fan-out because it runs in the background, where waiting
		// is free.
		const statsPromises = runningContainers.map(async (container) => {
			try {
				const stats = await withTimeout(
					getContainerStats(container.id, envIdNum) as Promise<any>,
					8000, // 8 second timeout per container (TLS proxy + Docker CPU sampling needs ~2s)
					null
				);

				if (!stats) return null;

				const cpuPercent = calculateCpuPercent(stats);
				// Calculate memory usage the same way Docker CLI does (excludes cache)
				const memory = calculateMemoryUsage(stats.memory_stats);
				const memoryLimit = calculateMemoryLimit(stats);
				const memoryPercent = memoryLimit > 0 ? (memory.usage / memoryLimit) * 100 : 0;
				const networkIO = calculateNetworkIO(stats);
				const blockIO = calculateBlockIO(stats);

				return {
					id: container.id,
					name: container.name,
					cpuPercent: Math.round(cpuPercent * 100) / 100,
					memoryUsage: memory.usage,
					memoryRaw: memory.raw,
					memoryCache: memory.cache,
					memoryLimit,
					memoryPercent: Math.round(memoryPercent * 100) / 100,
					networkRx: networkIO.rx,
					networkTx: networkIO.tx,
					blockRead: blockIO.read,
					blockWrite: blockIO.write
				};
			} catch (err) {
				// Silently skip failed containers
				return null;
			}
		});

		const allStats = await Promise.all(statsPromises);
		const validStats = allStats.filter((s): s is ContainerStats => s !== null);

		return json(validStats);
	} catch (error: any) {
		// Return 404 for deleted environments so client can clear stale cache
		if (error instanceof EnvironmentNotFoundError) {
			return json({ error: 'Environment not found' }, { status: 404 });
		}
		console.error('Failed to get container stats:', error.message || error);
		return json([], { status: 200 }); // Return empty array instead of error
	}
};
