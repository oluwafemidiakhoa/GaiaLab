import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULTS = {
  endpoint: 'http://localhost:8787/analyze',
  benchmarks: 'data/benchmarks/gaialab-benchmarks.json',
  timeout: 180000,
  strict: false,
  out: 'data/eval/last-run.json',
  includeDrugs: undefined,
  bypassCache: undefined
};

const args = process.argv.slice(2);
const options = { ...DEFAULTS };

const parseBool = (value) => {
  if (value === undefined) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return undefined;
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--strict') {
    options.strict = true;
    continue;
  }

  const [key, inlineValue] = arg.split('=');
  const nextValue = inlineValue !== undefined ? inlineValue : args[i + 1];

  switch (key) {
    case '--endpoint':
      options.endpoint = nextValue;
      if (inlineValue === undefined) i += 1;
      break;
    case '--benchmarks':
      options.benchmarks = nextValue;
      if (inlineValue === undefined) i += 1;
      break;
    case '--timeout':
      options.timeout = Number(nextValue) || options.timeout;
      if (inlineValue === undefined) i += 1;
      break;
    case '--out':
      options.out = nextValue;
      if (inlineValue === undefined) i += 1;
      break;
    case '--includeDrugs': {
      const parsed = parseBool(nextValue);
      options.includeDrugs = parsed;
      if (inlineValue === undefined) i += 1;
      break;
    }
    case '--bypassCache': {
      const parsed = parseBool(nextValue);
      options.bypassCache = parsed;
      if (inlineValue === undefined) i += 1;
      break;
    }
    default:
      break;
  }
}

const loadBenchmarks = async () => {
  const raw = await readFile(options.benchmarks, 'utf8');
  return JSON.parse(raw);
};

const parseDurationMs = (value) => {
  if (!value) return null;
  const digits = String(value).match(/[0-9]+/g);
  if (!digits) return null;
  return Number(digits.join(''));
};

const normalizeText = (value) => String(value || '').toLowerCase();

const collectFieldText = (items, fields) => {
  return (items || [])
    .map(item => fields.map(field => item?.[field]).filter(Boolean).join(' '))
    .join(' ');
};

const matchExpectedTerms = (expected, text) => {
  const normalizedText = normalizeText(text);
  const matched = [];
  const missing = [];

  (expected || []).forEach(term => {
    const normalized = normalizeText(term);
    if (!normalized) return;
    if (normalizedText.includes(normalized)) {
      matched.push(term);
    } else {
      missing.push(term);
    }
  });

  return { matched, missing };
};

const scoreResult = (metrics) => {
  const papers = Math.min(metrics.papersUsed, 10) * 4;
  const evidence = Math.min(metrics.evidenceItems, 10) * 3;
  const pathways = Math.min(metrics.pathways, 5) * 2;
  const strategies = Math.min(metrics.strategies, 5) * 2;
  const hypotheses = Math.min(metrics.hypotheses, 5) * 2;
  return Math.round(papers + evidence + pathways + strategies + hypotheses);
};

const fetchWithTimeout = async (payload) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout);

  try {
    const response = await fetch(options.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
};

const evaluateCase = async (caseConfig, defaults) => {
  const includeDrugs = options.includeDrugs ?? caseConfig.includeDrugs ?? defaults.includeDrugs;
  const bypassCache = options.bypassCache ?? caseConfig.bypassCache ?? defaults.bypassCache;
  const payload = {
    genes: caseConfig.genes,
    diseaseContext: caseConfig.diseaseContext,
    audience: caseConfig.audience || defaults.audience,
    includeDrugs,
    bypassCache
  };

  const response = await fetchWithTimeout(payload);

  const quality = response.qualityMetrics || {};

  const pathways = quality.pathways ?? response.pathways?.length ?? 0;
  const topics = quality.topics ?? response.topics?.length ?? 0;
  const strategies = quality.strategies ?? response.strategies?.length ?? 0;
  const hypotheses = quality.hypotheses ?? response.novelHypotheses?.hypotheses?.length ?? 0;
  const papersUsed = quality.papersUsed ?? response.totalPapersUsed ?? response.citations?.length ?? 0;
  const evidenceItems = quality.evidenceItems ?? response.evidenceSummary?.totalItems ?? 0;
  const evidencePapers = quality.evidencePapers ?? response.evidenceSummary?.papersWithEvidence ?? 0;

  let groundedRatio = quality.groundedRatio;
  if (groundedRatio === undefined || groundedRatio === null) {
    const groundedPathways = response.pathways?.filter(p => p.evidenceStatus === 'grounded').length || 0;
    const groundedStrategies = response.strategies?.filter(s => s.evidenceStatus === 'grounded').length || 0;
    const groundedTopics = response.topics?.filter(t => t.evidenceStatus === 'grounded').length || 0;
    const groundedTotal = groundedPathways + groundedStrategies + groundedTopics;
    const insightTotal = pathways + strategies + topics;
    groundedRatio = insightTotal > 0 ? groundedTotal / insightTotal : 0;
  }

  const availability = response.dataAvailability || {};
  const availabilityNotes = [];
  if (availability.interactions?.biogrid === false) availabilityNotes.push('BioGRID disabled');
  if (availability.clinical?.disgenet === false) availabilityNotes.push('DisGeNET disabled');
  if (availability.literature?.semanticScholar === false) availabilityNotes.push('Semantic Scholar disabled');
  if (includeDrugs && availability.drugs?.drugbankFallback) availabilityNotes.push('DrugBank fallback in use');
  if (includeDrugs && availability.drugs?.drugbank === false) availabilityNotes.push('DrugBank disabled');

  const metrics = {
    analysisTimeMs: parseDurationMs(response.analysisTime),
    model: response.dataSource?.ai,
    pathways,
    topics,
    strategies,
    hypotheses,
    papersUsed,
    evidenceItems,
    evidencePapers,
    groundedRatio: Number(Number(groundedRatio || 0).toFixed(2)),
    availableDatabases: quality.sourcesAvailable ?? response.databaseStats?.availableCount ?? null
  };

  const pathwayText = collectFieldText(response.pathways, ['name', 'significance', 'rationale', 'description']);
  const strategyText = collectFieldText(response.strategies, ['label', 'rationale', 'molecularTarget', 'description']);
  const topicText = collectFieldText(response.topics, ['theme', 'summary', 'description']);
  const whyText = response.whyItMatters?.summary || '';

  const expectationMatches = {
    pathways: matchExpectedTerms(caseConfig.expectedPathways, pathwayText),
    strategies: matchExpectedTerms(caseConfig.expectedStrategies, strategyText),
    topics: matchExpectedTerms(caseConfig.expectedTopics, topicText),
    whyItMatters: matchExpectedTerms(caseConfig.expectedWhyItMatters, whyText)
  };

  const expectedTotal = (
    expectationMatches.pathways.matched.length + expectationMatches.pathways.missing.length +
    expectationMatches.strategies.matched.length + expectationMatches.strategies.missing.length +
    expectationMatches.topics.matched.length + expectationMatches.topics.missing.length +
    expectationMatches.whyItMatters.matched.length + expectationMatches.whyItMatters.missing.length
  );
  const expectedMatched = (
    expectationMatches.pathways.matched.length +
    expectationMatches.strategies.matched.length +
    expectationMatches.topics.matched.length +
    expectationMatches.whyItMatters.matched.length
  );
  const expectationScore = expectedTotal > 0 ? Math.round((expectedMatched / expectedTotal) * 100) : null;

  const thresholds = {
    minPapersUsed: caseConfig.minPapersUsed ?? defaults.minPapersUsed,
    minPathways: caseConfig.minPathways ?? defaults.minPathways,
    minStrategies: caseConfig.minStrategies ?? defaults.minStrategies,
    minEvidenceItems: caseConfig.minEvidenceItems ?? defaults.minEvidenceItems,
    minHypotheses: caseConfig.minHypotheses ?? defaults.minHypotheses,
    minScore: caseConfig.minScore ?? defaults.minScore
  };

  const warnings = [];
  if (metrics.papersUsed < thresholds.minPapersUsed) {
    warnings.push(`papersUsed ${metrics.papersUsed} < ${thresholds.minPapersUsed}`);
  }
  if (metrics.pathways < thresholds.minPathways) {
    warnings.push(`pathways ${metrics.pathways} < ${thresholds.minPathways}`);
  }
  if (metrics.strategies < thresholds.minStrategies) {
    warnings.push(`strategies ${metrics.strategies} < ${thresholds.minStrategies}`);
  }
  if (metrics.evidenceItems < thresholds.minEvidenceItems) {
    warnings.push(`evidenceItems ${metrics.evidenceItems} < ${thresholds.minEvidenceItems}`);
  }
  if (metrics.hypotheses < thresholds.minHypotheses) {
    warnings.push(`hypotheses ${metrics.hypotheses} < ${thresholds.minHypotheses}`);
  }

  const score = quality.score ?? scoreResult(metrics);
  if (score < thresholds.minScore) {
    warnings.push(`score ${score} < ${thresholds.minScore}`);
  }

  if (expectationMatches.pathways.missing.length > 0) {
    warnings.push(`expectedPathways missing: ${expectationMatches.pathways.missing.join(', ')}`);
  }
  if (expectationMatches.strategies.missing.length > 0) {
    warnings.push(`expectedStrategies missing: ${expectationMatches.strategies.missing.join(', ')}`);
  }
  if (expectationMatches.topics.missing.length > 0) {
    warnings.push(`expectedTopics missing: ${expectationMatches.topics.missing.join(', ')}`);
  }
  if (expectationMatches.whyItMatters.missing.length > 0) {
    warnings.push(`expectedWhyItMatters missing: ${expectationMatches.whyItMatters.missing.join(', ')}`);
  }

  return {
    id: caseConfig.id,
    payload,
    metrics: { ...metrics, score, expectationScore },
    warnings,
    availabilityNotes,
    expectations: expectationMatches
  };
};

const run = async () => {
  const startedAt = new Date().toISOString();
  const benchmark = await loadBenchmarks();
  const defaults = benchmark.defaults || {};
  const cases = benchmark.cases || [];

  if (cases.length === 0) {
    console.error('No benchmark cases found.');
    process.exit(1);
  }

  const results = [];
  const failures = [];

  for (const caseConfig of cases) {
    console.log(`\n[Eval] ${caseConfig.id} (${caseConfig.genes.join(', ')})`);
    try {
      const result = await evaluateCase(caseConfig, defaults);
      results.push(result);

      const timeLabel = result.metrics.analysisTimeMs ? `${result.metrics.analysisTimeMs}ms` : 'n/a';
      const expectationLabel = result.metrics.expectationScore !== null && result.metrics.expectationScore !== undefined
        ? ` expectation=${result.metrics.expectationScore}%`
        : '';
      console.log(`  score=${result.metrics.score} time=${timeLabel} papers=${result.metrics.papersUsed} evidence=${result.metrics.evidenceItems} pathways=${result.metrics.pathways} strategies=${result.metrics.strategies} hypotheses=${result.metrics.hypotheses} grounded=${result.metrics.groundedRatio}${expectationLabel}`);

      if (result.warnings.length > 0) {
        console.log(`  warnings: ${result.warnings.join(' | ')}`);
      }

      if (result.availabilityNotes.length > 0) {
        console.log(`  availability: ${result.availabilityNotes.join(' | ')}`);
      }

      if (options.strict && result.warnings.length > 0) {
        failures.push(result.id);
      }
    } catch (error) {
      console.error(`  error: ${error.message}`);
      failures.push(caseConfig.id);
      results.push({
        id: caseConfig.id,
        payload: {
          genes: caseConfig.genes,
          diseaseContext: caseConfig.diseaseContext,
          audience: caseConfig.audience || defaults.audience
        },
        error: error.message
      });
    }
  }

  const scores = results.map(r => r.metrics?.score).filter(Number.isFinite);
  const times = results.map(r => r.metrics?.analysisTimeMs).filter(Number.isFinite);
  const papers = results.map(r => r.metrics?.papersUsed).filter(Number.isFinite);
  const evidence = results.map(r => r.metrics?.evidenceItems).filter(Number.isFinite);
  const hypotheses = results.map(r => r.metrics?.hypotheses).filter(Number.isFinite);
  const expectationScores = results.map(r => r.metrics?.expectationScore).filter(Number.isFinite);

  const avg = (values) => {
    if (values.length === 0) return 0;
    const total = values.reduce((sum, v) => sum + v, 0);
    return Number((total / values.length).toFixed(2));
  };

  const summary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    totalCases: cases.length,
    failures: failures.length,
    avgScore: avg(scores),
    avgTimeMs: avg(times),
    avgPapersUsed: avg(papers),
    avgEvidenceItems: avg(evidence),
    avgHypotheses: avg(hypotheses),
    avgExpectationScore: avg(expectationScores)
  };

  console.log('\n[Eval] Summary');
  console.log(`  cases=${summary.totalCases} failures=${summary.failures} avgScore=${summary.avgScore} avgTimeMs=${summary.avgTimeMs}`);

  const output = {
    options,
    benchmarkVersion: benchmark.version,
    summary,
    results
  };

  if (options.out) {
    const outDir = path.dirname(options.out);
    await mkdir(outDir, { recursive: true });
    await writeFile(options.out, JSON.stringify(output, null, 2));
    console.log(`  wrote=${options.out}`);
  }

  if (failures.length > 0) {
    process.exit(1);
  }
};

run().catch((error) => {
  console.error(`[Eval] Fatal: ${error.message}`);
  process.exit(1);
});
