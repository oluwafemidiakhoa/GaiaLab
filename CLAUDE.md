# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GaiaLab** is a revolutionary AI-powered Biological Intelligence Platform that transforms gene lists into actionable insights in 60 seconds. Built as a Model Context Protocol (MCP) server, it integrates with ChatGPT/Claude to provide researchers, clinicians, and biotech companies with publication-quality biological insights.

### What Makes This Revolutionary

- **Real Data Integration**: Live data from UniProt (proteins), KEGG (pathways), PubMed (literature)
- **AI Synthesis**: Claude 3.5 Sonnet generates insights with citations and confidence scores
- **Statistical Rigor**: Fisher's exact test for pathway enrichment with p-values
- **Citation-Backed**: Every insight linked to real PubMed papers
- **60-Second Analysis**: 200x faster than manual literature review

### Business Model: Path to $1B Valuation

- Freemium SaaS ($0/$99/$499 per month)
- Target: $150K Year 1 → $2M Year 2 → $11M Year 3 → $500M-$1B exit
- Exit options: Pharma acquisition (Roche, Pfizer) or Tech (Google Health, Amazon)

## Development Commands

```bash
npm install            # Install dependencies
npm start              # Run production server
npm run dev           # Run with nodemon (watches src/ and public/ for changes)
```

### Required Setup

1. **Create `.env` file** (copy from `.env.example`):
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...  # REQUIRED for AI synthesis
NCBI_API_KEY=...                     # OPTIONAL for faster PubMed access
PORT=8787
```

2. **Get API Keys**:
   - Anthropic: https://console.anthropic.com/ (required, ~$0.50/analysis)
   - NCBI: https://www.ncbi.nlm.nih.gov/account/ (optional, increases rate limit)

The server listens on port 8787 by default.

## Architecture

### Revolutionary Data Pipeline

GaiaLab performs 3-phase analysis in ~15-20 seconds:

1. **Parallel Data Fetch** (~5s): UniProt + KEGG + PubMed in parallel using `Promise.all()`
2. **AI Synthesis** (~10s): Claude 3.5 Sonnet generates insights with citations
3. **Widget Rendering**: Display genes, pathways, citations with confidence scores

### MCP Server Design

**Stateless HTTP-based MCP server**:
- Each HTTP POST to `/mcp` creates fresh `McpServer` instance
- Uses `StreamableHTTPServerTransport` (stateless mode)
- Server/transport closed on client disconnect
- No persistent sessions (Phase 2 will add PostgreSQL + Redis)

### Resource-Tool Pattern

The MCP server registers two key components:

1. **Resource**: `gaialab-widget` at URI `ui://widget/gaialab.html`
   - Served with MIME type `text/html+skybridge`
   - HTML content loaded once at startup from [public/gaialab-widget.html](public/gaialab-widget.html)
   - Contains `_meta.openai/widgetPrefersBorder: true` for UI rendering

2. **Tool**: `gaialab_generate_insights`
   - Input schema validated with Zod: `genes` (string array), `diseaseContext` (string), `audience` (enum)
   - Returns both text content and structured data via `structuredContent`
   - Metadata specifies `openai/outputTemplate: ui://widget/gaialab.html` to render in widget

### Data Integration Architecture

**Three-Layer Integration**:

1. **Integration Layer** ([src/data/integrations/](src/data/integrations/)):
   - [pubmed-client.js](src/data/integrations/pubmed-client.js): NCBI E-utilities API for biomedical literature
   - [uniprot-client.js](src/data/integrations/uniprot-client.js): UniProt REST API for protein data
   - [kegg-client.js](src/data/integrations/kegg-client.js): KEGG REST API for pathway data

2. **Aggregation Layer** ([src/data/aggregators/](src/data/aggregators/)):
   - [gene-aggregator.js](src/data/aggregators/gene-aggregator.js): Consolidates multi-source gene data
   - [pathway-aggregator.js](src/data/aggregators/pathway-aggregator.js): Statistical enrichment (Fisher's exact test)
   - [literature-aggregator.js](src/data/aggregators/literature-aggregator.js): Ranks papers by relevance

3. **AI Synthesis Layer** ([src/ai/models/](src/ai/models/)):
   - [insight-generator.js](src/ai/models/insight-generator.js): Claude 3.5 Sonnet synthesis with citation validation

### Frontend-Backend Communication

Widget ([public/gaialab-widget.html](public/gaialab-widget.html)) displays:
- **Confidence badges** (high/medium/low based on citation count)
- **Clickable citations** (links to PubMed)
- **Data source badges** (shows UniProt, KEGG, PubMed, Claude)
- **Analysis time** (performance tracking)

**Backend → Frontend**:
- Initial: `window.openai.toolOutput` with structured board + citations
- Updates: `openai:set_globals` events

**Frontend → Backend**:
- Audience changes → `window.openai.callTool()` re-invokes with new perspective

### Data Flow

```
ChatGPT User → MCP Tool Call (genes, diseaseContext, audience)
              ↓
buildGaiaBoard() synthesizes:
  - Gene cards with importance scores
  - 3 predefined pathway categories
  - 3 literature themes
  - 3 therapeutic strategies
              ↓
replyWithBoard() returns { content[], structuredContent }
              ↓
Widget renders 4-section grid (Genes, Pathways, Themes, Strategies)
              ↓
[Optional] User changes audience → callTool() → re-render
```

### Input Validation

Input schema ([src/server.js:10-23](src/server.js#L10-L23)):
- `genes`: Array of strings, minimum 1 gene required
- `diseaseContext`: Non-empty string describing disease/biological context
- `audience`: Enum of `researcher` | `clinician` | `executive` | `student` (default: `researcher`)

If validation fails or inputs are incomplete, the tool still returns a board with a message prompting for proper inputs.

### Output Structure

The `buildGaiaBoard()` function ([src/server.js:27-127](src/server.js#L27-L127)) generates a structured object with:
- `genes`: Array of `{ symbol, importanceScore, roleHint }`
- `pathways`: Array of `{ id, name, rationale, score }` - 3 predefined categories
- `topics`: Array of `{ id, name, summary }` - 3 literature themes
- `strategies`: Array of `{ id, label, summary, riskLevel }` - 3 therapeutic directions
- `audience`, `audienceLabel`, `generatedAtIso`, `disclaimer`

### Widget Implementation

The HTML widget ([public/gaialab-widget.html](public/gaialab-widget.html)) is a single-page interface with:
- Dark theme with gradient backgrounds and shadow effects
- Responsive grid layout (2 columns desktop, 1 column mobile at 768px breakpoint)
- Four card sections rendered dynamically via JavaScript modules
- Real-time timestamp formatting
- Empty state messages when data is incomplete

### HTTP Server Details

The HTTP server ([src/server.js:199-265](src/server.js#L199-L265)):
- Handles CORS preflight with `OPTIONS` requests
- Routes: `GET /` (health check), `POST|GET|DELETE /mcp` (MCP endpoint)
- Sets `Access-Control-Allow-Origin: *` for all MCP responses
- Exposes `Mcp-Session-Id` header (though session management is stateless)

## Key Design Principles

1. **Stateless**: Each MCP request is independent; no server-side sessions
2. **Non-empirical**: Uses synthetic, illustrative data rather than real databases
3. **Audience-aware**: Tailors presentation to different user types (researcher, clinician, etc.)
4. **Educational**: Includes prominent disclaimer that this is not medical/experimental guidance
5. **Minimal**: Only 2 source files totaling ~775 lines of code

## File Structure

```
gaialab-app/
├── src/
│   ├── server.js                           # MCP server + buildRealGaiaBoard()
│   ├── data/
│   │   ├── integrations/
│   │   │   ├── pubmed-client.js           # PubMed E-utilities API
│   │   │   ├── uniprot-client.js          # UniProt REST API
│   │   │   └── kegg-client.js             # KEGG pathway API
│   │   └── aggregators/
│   │       ├── gene-aggregator.js         # Multi-source gene consolidation
│   │       ├── pathway-aggregator.js      # Fisher's exact test enrichment
│   │       └── literature-aggregator.js   # PubMed paper ranking
│   └── ai/
│       └── models/
│           └── insight-generator.js       # Claude 3.5 Sonnet synthesis
├── public/
│   └── gaialab-widget.html                # UI with citations + confidence
├── .env.example                           # API key template
├── README.md                              # Installation + business model
├── CLAUDE.md                              # This file
└── package.json                           # Dependencies
```

## Key Implementation Details

### Performance Optimizations
- **Parallel API calls**: `Promise.all()` for UniProt + KEGG + PubMed (~5s total)
- **Target**: <60 second end-to-end analysis time
- **Logging**: Console timestamps for data fetch, AI synthesis, total time

### Data Quality & Safety
- **Citation validation**: Every AI insight requires ≥2 PubMed citations
- **Confidence scoring**:
  - High = 6+ citations
  - Medium = 2-5 citations
  - Low = <2 citations or hypothetical
- **Fallback handling**: Returns error board if APIs fail

### Statistical Enrichment
- **Method**: Hypergeometric test (approximation of Fisher's exact)
- **Formula**: P(X ≥ k) where X ~ Hypergeometric(N=20000, K=pathway_size, n=input_genes)
- **Output**: p-value + fold enrichment + significance flag

### AI Prompt Engineering
- **Temperature**: 0.3 (factual accuracy over creativity)
- **Max tokens**: 8000
- **Structured output**: Forces JSON response with specific schema
- **Audience-aware**: Different prompts for researcher/clinician/executive/student

### Gene Normalization
- All symbols converted to uppercase
- Importance scores: exponential decay (centrality = e^(-index/total))
- First gene assumed most central to analysis

## Common Development Tasks

### Adding a New Data Source

1. Create integration client in `src/data/integrations/`:
```javascript
export class NewSourceClient {
  async getData(geneSymbol) { /* ... */ }
}
export const newSourceClient = new NewSourceClient();
```

2. Add to aggregator (e.g., `gene-aggregator.js`):
```javascript
import { newSourceClient } from '../integrations/new-source-client.js';
// Merge data in fetchGeneData()
```

3. Update `buildRealGaiaBoard()` in `server.js` to include new data

### Modifying AI Synthesis

Edit [src/ai/models/insight-generator.js](src/ai/models/insight-generator.js:1):
- `buildSynthesisPrompt()` - Change prompt structure
- `validateAndEnhanceInsights()` - Add new validation rules
- `calculateConfidence()` - Adjust confidence thresholds

### Adding Widget Features

Edit [public/gaialab-widget.html](public/gaialab-widget.html:1):
- CSS: Lines 6-306 (styling)
- Rendering functions: Lines 380-553 (JavaScript)
- Add new render functions before `renderAll()` (line 555)

## Troubleshooting

### "ANTHROPIC_API_KEY not found"
- Create `.env` file: `cp .env.example .env`
- Add your key: `ANTHROPIC_API_KEY=sk-ant-...`

### API Rate Limits
- PubMed: 3 requests/second (10/sec with NCBI_API_KEY)
- UniProt: No official limit (be respectful)
- KEGG: Academic use only, rate limit unknown
- Claude: 50 requests/minute (Tier 1), 1000/min (Tier 2+)

### Slow Analysis Times
- Check console logs for bottleneck (data fetch vs AI synthesis)
- PubMed is usually slowest (~3-5 seconds)
- AI synthesis depends on literature volume (~5-15 seconds)
- Consider caching popular genes (Phase 2 feature: Redis)

## Next Phase Features (Phase 2: Beta Launch)

When implementing these features, refer to the transformation plan:

1. **SaaS Infrastructure**: Stripe integration, Auth0, usage tracking
2. **Export Pipeline**: PDF (Puppeteer), PowerPoint (PptxGenJS), CSV
3. **Collaboration**: PostgreSQL for persistent storage, team workspaces
4. **Advanced AI**: Multi-model synthesis (Claude + GPT-4), hypothesis engine

See the transformation plan at `~/.claude/plans/snoopy-munching-sunrise.md` for detailed implementation strategy.
