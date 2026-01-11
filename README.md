# GaiaLab: AI-Powered Biological Intelligence Platform 🧬

**Transform gene lists into actionable insights in 60 seconds — now with drug repurposing.**

> 🌟 **Developed by Oluwafemi Idiakhoa** — The most advanced biological intelligence synthesis platform

GaiaLab is a revolutionary MCP (Model Context Protocol) server that integrates **13 biological databases** with AI-powered synthesis to deliver publication-quality insights. By cross-validating findings across multiple independent sources, GaiaLab demonstrates how **truth emerges through consensus**. Now featuring an enterprise-grade **Drug Repurposing Engine** with $2.3B+ savings potential per drug.

## 🚀 What Makes This Revolutionary

- **13 Data Sources**: The most comprehensive biological data integration ever built for an MCP server (now with Semantic Scholar citation enrichment)
- **3 Cross-Validation Domains**: Protein interactions, disease associations, and drug targets
- **Multi-Source Intelligence**: When independent databases agree → truth emerges with high confidence
- **60-Second Analysis**: What takes researchers 2 weeks, GaiaLab delivers instantly
- **AI Synthesis**: Multi-model AI architecture with automatic failover generates insights with citations and confidence scores
- **Citation-Backed**: Every insight linked to real PubMed papers
- **Statistical Rigor**: Fisher's exact test for pathway enrichment with p-values
- **💊 Drug Repurposing Engine**: Enterprise AI feature analyzing 2.4M compounds with $2.3B+ savings potential per drug

## 🏗️ Complete Data Architecture (13/13 Sources)

### 📊 Gene Layer (4 Sources)
| Source | Purpose | Data Type |
|--------|---------|-----------|
| **Ensembl** | Genomic coordinates, transcripts, gene structure | Genomic |
| **ClinVar** | Pathogenic variant classification | Clinical |
| **UniProt** | Protein function, expression, domains | Protein |
| **Gene Ontology** | Standardized functional annotations (BP/MF/CC) | Functional |

### 🧬 Pathway Layer (1 Source)
| Source | Purpose |
|--------|---------|
| **KEGG** | Metabolic & signaling pathways with enrichment |

### 📚 Literature Layer (2 Sources - **Citation-Enriched**)
| Source | Purpose | Features |
|--------|---------|----------|
| **PubMed** | 36M+ biomedical papers with relevance ranking | Paper metadata, abstracts |
| **Semantic Scholar** | Citation metrics & recommendations | Citation counts, author networks, OA links |

**Citation Enhancement:** Papers enriched with citation counts, impact indicators (🔥 500+ citations, ⭐ 100+ citations), and Open Access download links

### 🔗 Interaction Layer (2 Sources - **Cross-Validated**)
| Source | Type | Validation |
|--------|------|-----------|
| **STRING** | Computational protein interactions | Predicted |
| **BioGRID** | Experimental protein interactions | Validated |

**Cross-Validation:** When STRING + BioGRID confirm same interaction → **+15% confidence**

### 🏥 Clinical Layer (2 Sources - **Cross-Validated**)
| Source | Type | Evidence |
|--------|------|----------|
| **Open Targets** | Genetic disease evidence | GWAS, Genomic |
| **DisGeNET** | Disease associations | Literature, GWAS |

**Cross-Validation:** When Open Targets + DisGeNET agree → **+15% confidence**

### 💊 Drug Layer (2 Sources - **Cross-Validated**)
| Source | Database Size | Type |
|--------|---------------|------|
| **ChEMBL** | 2.4M bioactive compounds | Potency data |
| **DrugBank** | 14K approved + experimental drugs | FDA status |

**Cross-Validation:** When ChEMBL + DrugBank agree → **+15% confidence**

## 💡 Cross-Validation: How Truth Emerges

GaiaLab demonstrates emergent intelligence through **multi-source validation**:

```
Single Source:       Medium Confidence (60-75%)
Two Sources Agree:   High Confidence (75-90%)  ← +15% boost
Experimental Data:   Very High (85-95%)
```

**Example:**
- STRING predicts TP53-MDM2 interaction (score: 0.7)
- BioGRID confirms with experimental data (validated: true)
- **Final confidence: 0.85** (0.7 + 0.15 boost)

## 🛠️ Installation

### Prerequisites
- Node.js 18+ (ES modules)
- At least one AI API key (DeepSeek recommended for speed, see below)

### Quick Start

```bash
# Clone and install
cd gaialab-app
npm install

# Configure API keys
cp .env.example .env
# Edit .env and add at least one AI API key (DeepSeek recommended)

# Run the server
npm start              # Production
npm run dev            # Development (auto-reload)
```

Server starts on **http://localhost:8787**

## 🔑 API Keys

### AI Configuration (At Least One Required)
GaiaLab supports multiple AI providers with automatic failover:

- **DEEPSEEK_API_KEY**: Get at https://platform.deepseek.com/
- **OPENAI_API_KEY**: Get at https://platform.openai.com/
- **GOOGLE_API_KEY**: Get at https://makersuite.google.com/
- **ANTHROPIC_API_KEY**: Get at https://console.anthropic.com/

Configure at least one API key for AI-powered synthesis.

### Data Sources (Optional - Enhance Performance)
- **NCBI_API_KEY**: PubMed rate limit 3→10 req/sec (free)
- **BIOGRID_API_KEY**: Protein interaction cross-validation (free)
- **DISGENET_API_KEY**: Disease association cross-validation (free)
- **DRUGBANK_API_KEY**: Drug target cross-validation (paid, public fallback available)

See [.env.example](.env.example) for all configuration options.

### Optional: Semantic Scholar (Citation Enrichment)
- **SEMANTIC_SCHOLAR_API_KEY**: Free at https://www.semanticscholar.org/product/api
- Enables citation counts, author networks, and Open Access links

## ✨ Advanced Features

### Citation Enrichment
- **Citation Counts**: Display citation metrics for every paper (e.g., "1,247 citations")
- **Impact Indicators**:
  - 🔥 Seminal papers (500+ citations)
  - ⭐ Highly influential (100+ citations)
- **Open Access Filter**: Toggle to show only papers with free PDF downloads
- **OA Download Links**: Direct links to Open Access PDFs when available

### Author Network Analysis
- **Leading Researchers**: Identifies top contributors in the field
- **Impact Scoring**: Weighted by paper count, citations, and authorship position
- **Role Classification**: Distinguishes senior researchers (PIs) from active contributors
- **Top Papers**: Shows each author's most-cited work

### Paper Recommendations
- **Related Papers**: Semantic Scholar's AI-powered recommendations based on top papers
- **Citation-Ranked**: Sorted by citation count for relevance
- **OA Availability**: Shows which recommended papers have free PDFs

### Performance Optimization
- **LRU Cache**: In-memory caching with 1-hour TTL
- **Instant Results**: Cached queries return in ~0.1s vs 25-60s for first query
- **Hit Rate Tracking**: Monitor cache performance (typically 70%+ hit rate)
- **Smart Eviction**: Automatically removes least-used results when cache fills

### Data Export
- **CSV Export**: Excel-compatible export of all analysis data
- **JSON Export**: Complete structured data export with metadata
- **Timestamped**: Files named with ISO date for organization
- **Comprehensive**: Includes genes, pathways, literature, researchers, and more

### 💊 Drug Repurposing Engine
**Enterprise Feature ($10K-50K/year value)** — AI-powered analysis to identify existing FDA-approved drugs for new disease indications

**5-Factor Scoring Algorithm:**
- 🎯 **Target Match (30%)**: Does the drug target your genes of interest?
- 🧬 **Pathway Overlap (20%)**: Drug affects disease-related pathways?
- 📊 **Clinical Evidence (20%)**: Existing trials or FDA approval?
- ✅ **Safety Profile (15%)**: FDA approval = proven safety
- ⚙️ **Mechanism Relevance (15%)**: Mechanism of action matches disease?

**Cost Savings Calculator:**
- New drug development: **$2.6B** over **10-15 years**
- Repurposed drug: **$300M** over **3-5 years**
- **Potential savings: $2.3B + 8 years faster**

**Features:**
- Analyzes ChEMBL (2.4M compounds) + DrugBank (14K drugs)
- Cross-validates drug targets across both databases
- Confidence scoring: High (≥70%), Medium (40-70%), Low (<40%)
- Shows current indication → proposed new indication
- Displays matched gene targets, mechanism of action, clinical phase
- Always visible with helpful fallback when no candidates found

**Example Output:**
```javascript
{
  drug: "Metformin",
  repurposingScore: 78,  // High confidence
  currentIndication: "Type 2 Diabetes",
  proposedIndication: "Alzheimer's Disease",
  matchedTargets: ["APP", "PSEN1"],
  estimatedSavings: "$1800M - $2300M",
  phase: "FDA Approved"
}
```

## 🎨 3D Network Visualization

GaiaLab features a **spectacular 3D protein interaction network** that rivals $10,000/year commercial tools — completely free and open source.

### Visual Effects
- ⭐ **Star Field Background**: 1,000 twinkling stars create a galaxy-like atmosphere
- 💫 **Pulsing Nodes**: FDA targets, network hubs, and druggable proteins glow with pulsing emissive effects (0.2-0.8 intensity oscillation)
- 🌈 **Gradient Links**: Confidence-based color coding
  - 🔴 Red: Low confidence (<40%)
  - 🟣 Purple: Medium confidence (40-70%)
  - 🟢 Green: High confidence (>70%)
- ✨ **Dramatic Particles**: 2-8 flowing particles per link based on confidence (60% faster than standard)
- 🎬 **Cinematic Camera**: 2.5-second fly-in animation from 3x distance for dramatic entrance

### Interactive Features
- 🎮 **Collapsible Control Panel**: Minimized by default to a 50px button — no more blocked views
  - Slides in/out from right edge with smooth cubic-bezier transitions
  - Hover effect: scales to 110%
  - Full network stats, search, and filters when expanded
- 🎯 **FDA Target Finder**: One-click zoom to FDA-approved drug targets
  - Click blue underlined "FDA Targets" count
  - Camera auto-zooms to target gene (1.5s smooth transition)
  - Sphere flashes bright gold 3 times (250ms intervals)
  - Panel auto-minimizes after zoom
- ⏱️ **Time-Lapse Network Evolution (1995-2025)**
  - Animated playback showing how protein interaction networks were discovered over 30 years
  - Heuristic: High confidence interactions = early discovery, Low confidence = recent
  - Era-based color coding:
    - 🔴 Red: 1990s discoveries
    - 🟠 Orange: 2000s discoveries
    - 🟡 Yellow: 2010s discoveries
    - 🟢 Green: 2020s discoveries
  - Play/Pause controls with adjustable speed slider
  - Manual color toggle: Switch between confidence colors and era colors
  - Real-time stats: Year display, visible interaction count, progress bar
- 💊 **Intelligent Drug Display**: Click any node to see:
  - ChEMBL IDs (e.g., CHEMBL4164)
  - Potency values (pIC50)
  - Mechanism of action
  - FDA approval badges & clinical trial phases

### Network Architecture
- **Rendering**: Three.js with WebGL acceleration
- **Layout**: 3d-force-graph with force-directed algorithm
- **Data Formatter**: Custom `network-formatter.js` module
- **Node Types**:
  - 🟣 Purple: Input genes (primary)
  - 🟡 Gold: FDA-approved drug targets
  - 🔵 Cyan: Druggable proteins (ChEMBL/DrugBank)
  - 🔴 Red: Network hubs (high centrality)
  - 🟢 Green: Interacting proteins (secondary)

### Performance
- **29 nodes, 28 links** for 3-gene analysis (e.g., Alzheimer's: APP, PSEN1, APOE)
- **Real-time rendering** at 60 FPS
- **Instant interactions** (search, zoom, filter)
- **Browser-based** — zero installation required

### Example Use Cases
```javascript
// Alzheimer's Disease Network
Input: ["APP", "PSEN1", "APOE"] + "Alzheimer's disease"
Output: 29-node network showing:
  - APP (gold) ← FDA target for Aducanumab
  - 26 interacting proteins from STRING/BioGRID
  - Confidence scores for each interaction
  - Drug targets highlighted in real-time
```

**Try it live:** [http://gaialab-production.up.railway.app](http://gaialab-production.up.railway.app)

## 📊 Example Analysis

### Input
```javascript
{
  "genes": ["TP53", "BRCA1", "EGFR"],
  "diseaseContext": "breast cancer",
  "audience": "researcher"
}
```

### Output
```javascript
{
  "genes": [
    {
      "symbol": "TP53",
      "genomicLocation": { "chromosome": "17", "start": 7661779, "end": 7687550 },
      "pathogenicVariants": { "pathogenic": 2847, "likelyPathogenic": 456 },
      "goAnnotations": { "biologicalProcesses": ["DNA damage response", "apoptosis"] }
    }
  ],
  "pathways": [
    { "name": "p53 signaling", "pvalue": 0.0001, "confidence": "high" }
  ],
  "interactions": {
    "totalInteractions": 156,
    "validated": 42  // BioGRID + STRING agreement
  },
  "clinical": {
    "totalAssociations": 89,
    "validated": 23  // Open Targets + DisGeNET agreement
  },
  "drugs": {
    "totalCompounds": 134,
    "approvedDrugs": 12,
    "validated": 8  // ChEMBL + DrugBank agreement
  },
  "dataSource": {
    "genes": "Ensembl + ClinVar + UniProt + GO",
    "interactions": "STRING + BioGRID",
    "clinical": "Open Targets + DisGeNET",
    "drugs": "ChEMBL + DrugBank"
  }
}
```

## 🚀 Performance

| Phase | Duration | Parallelization |
|-------|----------|-----------------|
| Data Fetch | 5-15s | 12 sources in parallel |
| AI Synthesis | 5-20s | Multi-model with automatic failover |
| **Total** | **10-35s** | 200x faster than manual |

**AI Synthesis:** 5-20s depending on model availability and data complexity

## 🧪 Usage with ChatGPT/Claude

1. Add GaiaLab as an MCP server
2. Ask: "Use GaiaLab to analyze TP53 and BRCA1 in breast cancer context"
3. Get instant cross-validated insights with citations!

## 💰 Business Model (Path to $1B)

### Freemium SaaS
- **Free**: 10 analyses/month
- **Professional ($99/mo)**: Unlimited analyses, exports, cross-validation metrics
- **Enterprise ($499/mo)**: API access, team workspaces, custom integrations

### Revenue Projections
- **Year 1**: $150K (100 paying users)
- **Year 2**: $2M (1,000 users + 10 enterprise)
- **Year 3**: $11M (5,000 users + 30 enterprise + pharma partnerships)
- **Exit**: $500M-$1B (pharma or tech acquisition)

## 🔬 Technical Stack

- **Runtime**: Node.js 22+ (ES modules)
- **MCP SDK**: @modelcontextprotocol/sdk v1.24.3
- **AI**: Multi-model architecture with automatic failover (DeepSeek, OpenAI, Google, Anthropic)
- **Visualization**: Three.js + 3d-force-graph (WebGL rendering)
- **Data APIs**: REST, GraphQL, E-utilities
- **Statistics**: Fisher's exact test, hypergeometric distribution
- **Caching**: In-memory LRU cache with 1-hour TTL (Redis in Phase 2)

## 📂 Project Structure

```
gaialab-app/
├── src/
│   ├── server.js                        # MCP server + orchestration
│   ├── data/
│   │   ├── integrations/               # 13 API clients
│   │   │   ├── ensembl-client.js
│   │   │   ├── clinvar-client.js
│   │   │   ├── uniprot-client.js
│   │   │   ├── go-client.js
│   │   │   ├── kegg-client.js
│   │   │   ├── pubmed-client.js
│   │   │   ├── semantic-scholar-client.js
│   │   │   ├── string-client.js
│   │   │   ├── biogrid-client.js
│   │   │   ├── opentargets-client.js
│   │   │   ├── disgenet-client.js
│   │   │   ├── chembl-client.js
│   │   │   └── drugbank-client.js
│   │   └── aggregators/                # Multi-source synthesis
│   │       ├── gene-aggregator.js      # 4-layer gene synthesis
│   │       ├── pathway-aggregator.js   # Enrichment analysis
│   │       ├── literature-aggregator.js
│   │       ├── interaction-aggregator.js # Cross-validation
│   │       ├── clinical-aggregator.js   # Cross-validation
│   │       └── drug-aggregator.js       # Cross-validation
│   ├── visualization/                   # 3D Network Rendering
│   │   └── network-formatter.js        # Three.js data formatting + timeline
│   └── ai/
│       └── models/
│           ├── insight-generator.js    # Multi-model AI synthesis
│           └── drug-repurposing-engine.js # 5-factor drug scoring algorithm
├── public/
│   ├── index.html                      # Homepage with 3D network
│   └── gaialab-widget.html             # Interactive widget UI
└── .env.example                        # API key template
```

## 🚦 Development Roadmap

### ✅ Phase 1: MVP (Complete - 13/13 Sources + 3D Visualization + Drug Repurposing)
- ✅ 13 biological data sources integrated (added Semantic Scholar)
- ✅ 3 cross-validation domains
- ✅ Multi-model AI synthesis with automatic failover across 4 providers
- ✅ Citation validation & confidence scoring
- ✅ **3D Network Visualization** with star field, pulsing nodes, gradient links, particles
- ✅ **Time-Lapse Network Evolution** (1995-2025) with era-based color coding
- ✅ **Collapsible UI** with FDA target finder & intelligent drug display
- ✅ **Drug Repurposing Engine** with 5-factor scoring & cost savings calculator
- ✅ Performance optimizations: Timeouts, optional drug aggregation, in-memory caching
- ✅ Analysis time: 10-35s (200x faster than manual)

### 🔄 Phase 2: Beta Launch (Next)
- [ ] Freemium SaaS (Stripe integration)
- [ ] PDF/PowerPoint export
- [ ] Team collaboration features
- [ ] Cache layer (Redis) for popular genes
- [ ] 1,000 users, $10K MRR

### 📅 Phase 3: Growth
- [ ] Enterprise API with rate limiting
- [ ] Clinical trial matcher
- [ ] Real-time alerts for new publications
- [ ] Advanced drug repurposing (clinical trial predictions, combination therapy)
- [ ] 5,000 users, $100K MRR
- [ ] Series A: $5M at $20M-$30M valuation

### 🎯 Phase 4: Scale
- [ ] Personalized medicine (HIPAA-compliant)
- [ ] Multi-language support
- [ ] Pharma partnerships (bulk licensing)
- [ ] 50,000 users, $1M MRR

## 🛡️ Compliance & Safety

- **Research Use Only**: Not for clinical decision-making
- **Multi-Source Validation**: Cross-reference findings across databases
- **Citation Required**: Every insight backed by ≥2 PubMed papers
- **Confidence Transparency**: Clear metrics for data quality
- **Disclaimers**: Prominent "requires expert validation" warnings

## 🤝 Contributing

This is a commercial project. For partnership/licensing inquiries, contact the author.

## 📄 License

Proprietary - All Rights Reserved

## 🙏 Acknowledgments

**Data Providers:**
- Ensembl, ClinVar, UniProt Consortium, Gene Ontology Consortium
- KEGG (Kyoto Encyclopedia of Genes and Genomes)
- NCBI / PubMed, STRING Database, BioGRID
- Open Targets Platform, DisGeNET
- ChEMBL / EMBL-EBI, DrugBank

**AI Partners:**
- DeepSeek
- OpenAI
- Google AI
- Anthropic

---

## 📊 Key Statistics

- **13 Data Sources** integrated with cross-validation (added Semantic Scholar)
- **3 Validation Domains** for multi-source consensus
- **Multi-Model AI** with automatic failover across 4 providers
- **3D Visualization** with 1,000 stars, pulsing nodes, gradient links, particle effects
- **Time-Lapse Evolution** animating 30 years of network discovery (1995-2025)
- **Drug Repurposing Engine** analyzing 2.4M compounds with 5-factor scoring
- **29-node networks** with force-directed layout (WebGL rendering at 60 FPS)
- **2.4M+ Compounds** from ChEMBL database
- **30M+ Papers** from PubMed literature
- **10-35 Second** average analysis time (with performance optimizations)
- **200x Faster** than manual literature review
- **$2.3B+ Savings** potential per repurposed drug vs. new development
- **Instant Results** for repeat queries (in-memory caching)

---

**🌟 Developed by Oluwafemi Idiakhoa** • Powered by 13 biological databases + multi-model AI + 3D visualization + drug repurposing engine • Designed to demonstrate emergent intelligence 🌍
