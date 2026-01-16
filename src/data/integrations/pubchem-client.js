/**
 * PubChem Client - chemical properties for compounds
 *
 * DATA SOURCE: PubChem PUG REST
 * - Free, open access
 * - Provides compound properties (MW, XLogP, SMILES, InChIKey)
 *
 * API Documentation: https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
 */

import { fetchWithTimeout, retryWithBackoff } from '../../utils/fetch-with-timeout.js';

const PUBCHEM_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

export class PubchemClient {
  constructor() {
    this.baseUrl = PUBCHEM_BASE;
    this.cache = new Map();
  }

  async getCompoundProperties(name) {
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      return null;
    }

    if (this.cache.has(cleanName)) {
      return this.cache.get(cleanName);
    }

    try {
      const properties = [
        'MolecularWeight',
        'XLogP',
        'IsomericSMILES',
        'InChIKey',
        'IUPACName'
      ];
      const url = `${this.baseUrl}/compound/name/${encodeURIComponent(cleanName)}/property/${properties.join(',')}/JSON`;

      const data = await this.fetchJson(url, 12000);
      const entry = data?.PropertyTable?.Properties?.[0];
      if (!entry) {
        this.cache.set(cleanName, null);
        return null;
      }

      const result = {
        cid: entry.CID,
        molecularWeight: entry.MolecularWeight,
        xlogp: entry.XLogP,
        smiles: entry.IsomericSMILES,
        inchikey: entry.InChIKey,
        iupacName: entry.IUPACName,
        source: 'PubChem'
      };

      this.cache.set(cleanName, result);
      return result;
    } catch (error) {
      this.cache.set(cleanName, null);
      return null;
    }
  }

  async enrichCompounds(compounds, options = {}) {
    const { maxCompounds = 20 } = options;
    const names = Array.from(
      new Set((compounds || []).map(compound => String(compound?.name || '').trim()).filter(Boolean))
    ).slice(0, maxCompounds);

    const results = {};
    for (const name of names) {
      results[name] = await this.getCompoundProperties(name);
    }

    return results;
  }

  async fetchJson(url, timeoutMs) {
    return retryWithBackoff(async () => {
      const response = await fetchWithTimeout(url, {}, timeoutMs);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    }, 2);
  }
}

export const pubchemClient = new PubchemClient();
