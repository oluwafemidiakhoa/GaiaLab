/**
 * In-Memory Result Cache for GaiaLab Analysis
 *
 * Purpose: Cache completed analysis results for common genes (TP53, BRCA1, EGFR, etc.)
 * Benefit: Instant results for repeat queries (0.1s vs 25-60s)
 *
 * Features:
 * - LRU (Least Recently Used) eviction policy
 * - Configurable TTL (Time To Live) - default 1 hour
 * - Max cache size to prevent memory bloat
 * - Cache key includes genes + diseaseContext + audience + includeDrugs
 *
 * Phase 2: Replace with Redis for multi-server deployment
 */

export class ResultCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100; // Max 100 cached results
    this.ttl = options.ttl || 3600000; // 1 hour default (in milliseconds)
    this.cache = new Map(); // Map maintains insertion order for LRU
    this.hitCount = 0;
    this.missCount = 0;
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
    const cached = this.cache.get(key);

    if (!cached) {
      this.missCount++;
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    // Move to end (most recently used) by deleting and re-adding
    this.cache.delete(key);
    this.cache.set(key, cached);

    this.hitCount++;
    console.log(`[Cache] HIT for ${params.genes.join(',')} (${this.hitRate()}% hit rate)`);
    return cached.result;
  }

  /**
   * Store result in cache with LRU eviction
   */
  set(params, result) {
    const key = this.generateKey(params);

    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      console.log(`[Cache] Evicted oldest entry: ${oldestKey}`);
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });

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
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: this.hitRate(),
      totalRequests: this.hitCount + this.missCount
    };
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
  ttl: 3600000   // 1 hour TTL
});
