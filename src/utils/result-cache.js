import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Tiered Result Cache for GaiaLab Analysis
 *
 * Purpose: Cache completed analysis results for common genes (TP53, BRCA1, EGFR, etc.)
 * Benefit: Instant results for repeat queries (0.1s vs 25-60s)
 *
 * Features:
 * - LRU (Least Recently Used) eviction policy
 * - Configurable TTL (Time To Live) - default 1 hour
 * - Optional disk tier for warm starts after restarts
 * - Cache key includes genes + diseaseContext + audience + includeDrugs
 *
 * Phase 2: Replace with Redis for multi-server deployment
 */

export class ResultCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100; // Max 100 cached results
    this.ttl = options.ttl || 3600000; // 1 hour default (in milliseconds)
    this.diskDir = options.diskDir || null;
    this.diskTtl = options.diskTtl || this.ttl;
    this.diskMaxEntries = options.diskMaxEntries || 200;
    this.cache = new Map(); // Map maintains insertion order for LRU
    this.inflight = new Map();
    this.hitCount = 0;
    this.missCount = 0;
    this.diskHitCount = 0;
    this.diskMissCount = 0;
  }

  /**
   * Generate cache key from analysis parameters
   * @private
   */
  generateKey({ genes, diseaseContext, audience, includeDrugs }) {
    // Sort genes to ensure consistent keys regardless of input order
    const sortedGenes = [...genes].sort().join(',');
    return `${sortedGenes}:${diseaseContext}:${audience}:${includeDrugs}`;
  }

  /**
   * Get cached result if available and not expired
   */
  get(params) {
    const key = this.generateKey(params);
    const cached = this.getMemoryEntry(key);

    if (!cached) {
      this.missCount++;
      return null;
    }

    this.hitCount++;
    console.log(`[Cache] HIT (memory) for ${params.genes.join(',')} (${this.hitRate()}% hit rate)`);
    return cached.result;
  }

  /**
   * Get cached result from memory or disk tier
   */
  async getTiered(params) {
    const key = this.generateKey(params);
    const cached = this.getMemoryEntry(key);

    if (cached) {
      this.hitCount++;
      console.log(`[Cache] HIT (memory) for ${params.genes.join(',')} (${this.hitRate()}% hit rate)`);
      return { result: cached.result, tier: 'memory', timestamp: cached.timestamp };
    }

    if (this.isDiskEnabled()) {
      const diskRecord = await this.readDiskEntry(key);
      if (diskRecord) {
        this.diskHitCount++;
        this.hitCount++;
        this.storeMemoryEntry(key, diskRecord.result, diskRecord.timestamp);
        console.log(`[Cache] HIT (disk) for ${params.genes.join(',')} (${this.hitRate()}% hit rate)`);
        return { result: diskRecord.result, tier: 'disk', timestamp: diskRecord.timestamp };
      }
      this.diskMissCount++;
    }

    this.missCount++;
    return null;
  }

  /**
   * Store result in cache with LRU eviction
   */
  set(params, result) {
    const key = this.generateKey(params);

    const timestamp = Date.now();
    this.storeMemoryEntry(key, result, timestamp);

    if (this.isDiskEnabled()) {
      this.persistToDisk(key, result, timestamp).catch((error) => {
        console.warn('[Cache] Disk write failed:', error.message);
      });
    }

    console.log(`[Cache] Stored result for ${params.genes.join(',')} (cache size: ${this.cache.size})`);
  }

  /**
   * Clear entire cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    console.log(`[Cache] Cleared ${size} entries`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      inflight: this.inflight.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      diskEnabled: this.isDiskEnabled(),
      diskHits: this.diskHitCount,
      diskMisses: this.diskMissCount,
      hitRate: this.hitRate(),
      totalRequests: this.hitCount + this.missCount
    };
  }

  async runWithInflight(params, work) {
    const key = this.generateKey(params);
    if (this.inflight.has(key)) {
      return this.inflight.get(key);
    }
    const promise = (async () => {
      try {
        return await work();
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, promise);
    return promise;
  }

  /**
   * Calculate cache hit rate as percentage
   * @private
   */
  hitRate() {
    const total = this.hitCount + this.missCount;
    if (total === 0) return 0;
    return ((this.hitCount / total) * 100).toFixed(1);
  }

  isDiskEnabled() {
    return Boolean(this.diskDir);
  }

  getMemoryEntry(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used) by deleting and re-adding
    this.cache.delete(key);
    this.cache.set(key, cached);
    return cached;
  }

  storeMemoryEntry(key, result, timestamp) {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      console.log(`[Cache] Evicted oldest entry: ${oldestKey}`);
    }
    this.cache.set(key, { result, timestamp });
  }

  buildDiskPath(key) {
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    return path.join(this.diskDir, `${hash}.json`);
  }

  async readDiskEntry(key) {
    if (!this.diskDir) return null;
    const filePath = this.buildDiskPath(key);
    try {
      const raw = await readFile(filePath, 'utf8');
      const record = JSON.parse(raw);
      if (!record || record.key !== key) {
        return null;
      }
      const age = Date.now() - record.timestamp;
      if (age > this.diskTtl) {
        await unlink(filePath);
        return null;
      }
      return record;
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        console.warn('[Cache] Disk read failed:', error.message);
      }
      return null;
    }
  }

  async persistToDisk(key, result, timestamp) {
    if (!this.diskDir) return;
    await mkdir(this.diskDir, { recursive: true });
    const record = {
      key,
      timestamp,
      result
    };
    const filePath = this.buildDiskPath(key);
    await writeFile(filePath, JSON.stringify(record));
    await this.pruneDiskIfNeeded();
  }

  async pruneDiskIfNeeded() {
    if (!this.diskDir || !this.diskMaxEntries) return;
    const entries = await readdir(this.diskDir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
    if (files.length <= this.diskMaxEntries) return;

    const fileStats = await Promise.all(
      files.map(async (entry) => {
        const filePath = path.join(this.diskDir, entry.name);
        const info = await stat(filePath);
        return { path: filePath, mtimeMs: info.mtimeMs };
      })
    );
    fileStats.sort((a, b) => a.mtimeMs - b.mtimeMs);
    const removeCount = fileStats.length - this.diskMaxEntries;
    await Promise.all(
      fileStats.slice(0, removeCount).map((entry) => unlink(entry.path).catch(() => null))
    );
  }

  /**
   * Pre-warm cache with common genes
   * Phase 2: Load from database of popular queries
   */
  async prewarm(analyzeFunction, commonQueries = []) {
    console.log(`[Cache] Pre-warming with ${commonQueries.length} common queries...`);

    for (const query of commonQueries) {
      try {
        const result = await analyzeFunction(query);
        this.set(query, result);
      } catch (error) {
        console.error(`[Cache] Pre-warm failed for ${query.genes.join(',')}:`, error.message);
      }
    }

    console.log(`[Cache] Pre-warming complete. Cache size: ${this.cache.size}`);
  }
}

// Export singleton instance
export const resultCache = new ResultCache({
  maxSize: 100,  // Max 100 cached analyses
  ttl: 3600000,  // 1 hour TTL
  diskDir: 'data/cache',
  diskMaxEntries: 200
});
