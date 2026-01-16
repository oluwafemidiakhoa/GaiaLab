/**
 * Snapshot Manager - versioned analysis snapshots for reproducibility
 */

import { mkdir, writeFile, appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const SNAPSHOT_DIR = 'data/snapshots';
const INDEX_FILE = path.join(SNAPSHOT_DIR, 'index.jsonl');

function buildSnapshotId(seed) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
  const hash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 8);
  return `${stamp}-${hash}`;
}

export async function saveAnalysisSnapshot(payload) {
  const seed = JSON.stringify(payload.query || {}) + JSON.stringify(payload.counts || {});
  const id = buildSnapshotId(seed);
  const record = {
    id,
    createdAt: new Date().toISOString(),
    ...payload
  };

  await mkdir(SNAPSHOT_DIR, { recursive: true });
  const filename = path.join(SNAPSHOT_DIR, `${id}.json`);
  await writeFile(filename, JSON.stringify(record, null, 2));

  const indexEntry = {
    id,
    createdAt: record.createdAt,
    query: record.query,
    counts: record.counts,
    sources: record.sources
  };
  await appendFile(INDEX_FILE, `${JSON.stringify(indexEntry)}\n`);

  return {
    id,
    path: filename
  };
}

export async function loadAnalysisSnapshot(snapshotId) {
  if (!snapshotId) {
    throw new Error('snapshotId required');
  }
  const filename = path.join(SNAPSHOT_DIR, `${snapshotId}.json`);
  const raw = await readFile(filename, 'utf8');
  const record = JSON.parse(raw);
  return {
    ...record,
    path: filename
  };
}
