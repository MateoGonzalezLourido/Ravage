import { createLogger } from './logger.js';
const log = createLogger('system-info');
import { os, si } from './libs.js';

/**
 * Retrieves system RAM and free disk space.
 * @returns {Promise<{totalRamGB: number, freeDiskGB: number}>}
 */
export async function getSystemResources() {
    try {
        const mem = await si.mem();
        const totalRamGB = mem.total / (1024 * 1024 * 1024);

        // Get free disk space for the root partition (or APP_DATA partition)
        const fsSize = await si.fsSize();
        // Typically, we want the partition where the app data is stored.
        // For simplicity, we'll take the first one or the one with the most free space if / isn't clear.
        const rootFs = fsSize.find(f => f.mount === '/') || fsSize[0];
        const freeDiskGB = (rootFs?.available || 0) / (1024 * 1024 * 1024);

        return { totalRamGB, freeDiskGB };
    } catch (e) {
        log.error({ err: e }, "Error getting system resources");
        // Fallback to os module for RAM if si fails
        return {
            totalRamGB: os.totalmem() / (1024 * 1024 * 1024),
            freeDiskGB: 0
        };
    }
}

/**
 * Recommends a cache strategy based on system resources.
 * @returns {Promise<{type: 'ram' | 'disk', sizeMB: number}>}
 */
export async function getRecommendedCacheStrategy() {
    const { totalRamGB, freeDiskGB } = await getSystemResources();

    if (totalRamGB >= 31) { // 32GB approx
        return { type: 'ram', sizeMB: 4096 };
    } else if (totalRamGB >= 15) { // 16GB approx
        return { type: 'ram', sizeMB: 2048 };
    } else if (totalRamGB >= 7) { // 8GB approx
        return { type: 'ram', sizeMB: 1024 };
    } else if (freeDiskGB > 50) {
        return { type: 'disk', sizeMB: 2048 }; // 2GB disk cache
    }

    return { type: 'ram', sizeMB: 256 }; // Minimal fallback
}
