import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULTS = {
  input: 'data/eval/last-run.json',
  out: 'data/eval/dashboard.html',
  title: 'GaiaLab Evaluation Dashboard'
};

const args = process.argv.slice(2);
const options = { ...DEFAULTS };

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  const [key, inlineValue] = arg.split('=');
  const nextValue = inlineValue !== undefined ? inlineValue : args[i + 1];

  switch (key) {
    case '--in':
    case '--input':
      options.input = nextValue;
      if (inlineValue === undefined) i += 1;
      break;
    case '--out':
      options.out = nextValue;
      if (inlineValue === undefined) i += 1;
      break;
    case '--title':
      options.title = nextValue;
      if (inlineValue === undefined) i += 1;
      break;
    default:
      break;
  }
}

const loadResults = async () => {
  const raw = await readFile(options.input, 'utf8');
  return JSON.parse(raw);
};

const buildHtml = (data) => {
  const results = data.results || [];
  const labels = results.map(result => result.id);

  const scores = results.map(result => result.metrics?.score ?? null);
  const times = results.map(result => result.metrics?.analysisTimeMs ?? null);
  const papers = results.map(result => result.metrics?.papersUsed ?? null);
  const evidence = results.map(result => result.metrics?.evidenceItems ?? null);
  const expectations = results.map(result => result.metrics?.expectationScore ?? null);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${options.title}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; background: #f8fafc; }
    h1 { margin-bottom: 6px; }
    .summary { margin-bottom: 20px; color: #475569; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
    .card { background: white; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0; }
    canvas { width: 100% !important; height: 260px !important; }
  </style>
</head>
<body>
  <h1>${options.title}</h1>
  <div class="summary">
    Cases: ${data.summary?.totalCases ?? results.length} • Failures: ${data.summary?.failures ?? 0} •
    Avg Score: ${data.summary?.avgScore ?? 'n/a'} • Avg Time: ${data.summary?.avgTimeMs ?? 'n/a'} ms •
    Avg Expectation: ${data.summary?.avgExpectationScore ?? 'n/a'}%
  </div>
  <div class="grid">
    <div class="card"><canvas id="scoreChart"></canvas></div>
    <div class="card"><canvas id="timeChart"></canvas></div>
    <div class="card"><canvas id="paperChart"></canvas></div>
    <div class="card"><canvas id="evidenceChart"></canvas></div>
    <div class="card"><canvas id="expectationChart"></canvas></div>
  </div>

  <script>
    const labels = ${JSON.stringify(labels)};
    const scores = ${JSON.stringify(scores)};
    const times = ${JSON.stringify(times)};
    const papers = ${JSON.stringify(papers)};
    const evidence = ${JSON.stringify(evidence)};
    const expectations = ${JSON.stringify(expectations)};

    const chartOptions = (title, color) => ({
      type: 'bar',
      data: { labels, datasets: [{ label: title, data: color.data, backgroundColor: color.fill }] },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, title: { display: true, text: title } },
        scales: { x: { ticks: { autoSkip: false } } }
      }
    });

    new Chart(document.getElementById('scoreChart'), chartOptions('Score', { data: scores, fill: '#6366f1' }));
    new Chart(document.getElementById('timeChart'), chartOptions('Analysis Time (ms)', { data: times, fill: '#14b8a6' }));
    new Chart(document.getElementById('paperChart'), chartOptions('Papers Used', { data: papers, fill: '#f59e0b' }));
    new Chart(document.getElementById('evidenceChart'), chartOptions('Evidence Items', { data: evidence, fill: '#10b981' }));
    new Chart(document.getElementById('expectationChart'), chartOptions('Expectation Match %', { data: expectations, fill: '#ef4444' }));
  </script>
</body>
</html>`;
};

const run = async () => {
  const data = await loadResults();
  const html = buildHtml(data);
  const outDir = path.dirname(options.out);
  await mkdir(outDir, { recursive: true });
  await writeFile(options.out, html);
  console.log(`[Dashboard] Wrote ${options.out}`);
};

run().catch((error) => {
  console.error(`[Dashboard] Error: ${error.message}`);
  process.exit(1);
});
