const MICRO_UNIT_PATTERN = '(?:u|\\u00b5|\\u03bc)M';

const EVIDENCE_PATTERNS = [
  {
    type: 'IC50',
    regex: new RegExp(`IC50\\s*(?:=|:)?\\s*([0-9]+(?:\\.[0-9]+)?)\\s*(${MICRO_UNIT_PATTERN}|nM|pM|mM)`, 'gi'),
    formatter: (match) => `IC50=${match[1]} ${normalizeUnit(match[2])}`
  },
  {
    type: 'EC50',
    regex: new RegExp(`EC50\\s*(?:=|:)?\\s*([0-9]+(?:\\.[0-9]+)?)\\s*(${MICRO_UNIT_PATTERN}|nM|pM|mM)`, 'gi'),
    formatter: (match) => `EC50=${match[1]} ${normalizeUnit(match[2])}`
  },
  {
    type: 'Ki',
    regex: new RegExp(`\\bKi\\s*(?:=|:)?\\s*([0-9]+(?:\\.[0-9]+)?)\\s*(${MICRO_UNIT_PATTERN}|nM|pM|mM)`, 'gi'),
    formatter: (match) => `Ki=${match[1]} ${normalizeUnit(match[2])}`
  },
  {
    type: 'Kd',
    regex: new RegExp(`\\bKd\\s*(?:=|:)?\\s*([0-9]+(?:\\.[0-9]+)?)\\s*(${MICRO_UNIT_PATTERN}|nM|pM|mM)`, 'gi'),
    formatter: (match) => `Kd=${match[1]} ${normalizeUnit(match[2])}`
  },
  {
    type: 'Km',
    regex: new RegExp(`\\bKm\\s*(?:=|:)?\\s*([0-9]+(?:\\.[0-9]+)?)\\s*(${MICRO_UNIT_PATTERN}|nM|pM|mM)`, 'gi'),
    formatter: (match) => `Km=${match[1]} ${normalizeUnit(match[2])}`
  },
  {
    type: 'kcat',
    regex: /\bkcat\s*(?:=|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*(s-1|s\^-1|\/s|s^-1)/gi,
    formatter: (match) => `kcat=${match[1]} ${normalizeUnit(match[2])}`
  },
  {
    type: 'pIC50',
    regex: /\bpIC50\s*(?:=|:)?\s*([0-9]+(?:\.[0-9]+)?)/gi,
    formatter: (match) => `pIC50=${match[1]}`
  },
  {
    type: 'HR',
    regex: /\bHR\s*(?:=|:)?\s*([0-9]+(?:\.[0-9]+)?)/gi,
    formatter: (match) => `HR=${match[1]}`
  },
  {
    type: 'OR',
    regex: /\bOR\s*(?:=|:)?\s*([0-9]+(?:\.[0-9]+)?)/gi,
    formatter: (match) => `OR=${match[1]}`
  },
  {
    type: 'p-value',
    regex: /\bp\s*(?:=|<|>)\s*([0-9]+(?:\.[0-9]+)?(?:e-?[0-9]+)?)/gi,
    formatter: (match) => `p${match[0].includes('<') ? '<' : match[0].includes('>') ? '>' : '='}${match[1]}`
  },
  {
    type: 'sample-size',
    regex: /\bn\s*=\s*([0-9]{2,5})/gi,
    formatter: (match) => `n=${match[1]}`
  },
  {
    type: 'patients',
    regex: /\b([0-9]{2,5})\s*(patients|subjects|participants|samples)\b/gi,
    formatter: (match) => `${match[1]} ${match[2]}`
  },
  {
    type: 'fold-change',
    regex: /\b([0-9]+(?:\.[0-9]+)?)\s*-?\s*fold\b/gi,
    formatter: (match) => `${match[1]}-fold`
  },
  {
    type: 'mPFS',
    regex: /\bmPFS\s*(?:=|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*(months|mos)\b/gi,
    formatter: (match) => `mPFS=${match[1]} ${match[2]}`
  },
  {
    type: 'mOS',
    regex: /\bmOS\s*(?:=|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*(months|mos)\b/gi,
    formatter: (match) => `mOS=${match[1]} ${match[2]}`
  },
  {
    type: 'PFS',
    regex: /\bPFS\s*(?:=|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*(months|mos)\b/gi,
    formatter: (match) => `PFS=${match[1]} ${match[2]}`
  },
  {
    type: 'OS',
    regex: /\bOS\s*(?:=|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*(months|mos)\b/gi,
    formatter: (match) => `OS=${match[1]} ${match[2]}`
  }
];

function normalizeUnit(unit) {
  if (!unit) return unit;
  const normalized = unit.replace(/\s+/g, '');
  return normalized.replace(/\u00b5|\u03bc/gi, 'u');
}

function extractFromText(text, pmid, maxItems) {
  const items = [];
  const seen = new Set();

  for (const pattern of EVIDENCE_PATTERNS) {
    const matches = text.matchAll(pattern.regex);
    for (const match of matches) {
      const label = pattern.formatter(match);
      const key = `${pattern.type}:${label}`.toLowerCase();

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);

      const contextStart = Math.max(0, match.index - 60);
      const contextEnd = Math.min(text.length, match.index + match[0].length + 60);
      const context = text.slice(contextStart, contextEnd).replace(/\s+/g, ' ').trim();

      items.push({
        pmid,
        type: pattern.type,
        label,
        raw: match[0],
        context
      });

      if (items.length >= maxItems) {
        break;
      }
    }

    if (items.length >= maxItems) {
      break;
    }
  }

  return items;
}

export function extractQuantitativeEvidence(papers, options = {}) {
  const { maxPerPaper = 5, maxTotal = 40 } = options;
  const byPmid = {};
  const allItems = [];

  for (const paper of papers || []) {
    if (!paper?.pmid) {
      continue;
    }

    const title = paper.title || '';
    const abstract = paper.abstract || '';
    const text = `${title}. ${abstract}`.trim();

    if (!text) {
      continue;
    }

    const items = extractFromText(text, paper.pmid, maxPerPaper);
    if (items.length === 0) {
      continue;
    }

    byPmid[paper.pmid] = {
      pmid: paper.pmid,
      items
    };

    allItems.push(...items);

    if (allItems.length >= maxTotal) {
      break;
    }
  }

  const topItems = allItems.slice(0, Math.min(allItems.length, 20)).map(item => ({
    pmid: item.pmid,
    label: item.label,
    context: item.context
  }));

  return {
    byPmid,
    summary: {
      totalItems: allItems.length,
      papersWithEvidence: Object.keys(byPmid).length,
      topItems
    }
  };
}
