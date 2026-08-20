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
        // Find the partition that contains the home directory (works on Linux, macOS and Windows)
        const homeDir = os.homedir();
        const rootFs = fsSize
            .filter(f => f.mount && homeDir.toLowerCase().startsWith(f.mount.toLowerCase()))
            .sort((a, b) => b.mount.length - a.mount.length)[0]
            || fsSize.find(f => f.mount === '/')
            || fsSize[0];
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

