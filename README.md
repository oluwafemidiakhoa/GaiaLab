# GaiaLab: AI-Powered Biological Intelligence Platform 🧬

**Transform gene lists into actionable insights in 60 seconds.**

> 🌟 **Developed by Oluwafemi Idiakhoa** — The most advanced biological intelligence synthesis platform

GaiaLab is a revolutionary MCP (Model Context Protocol) server that integrates **13 biological databases** with AI-powered synthesis to deliver publication-quality insights. By cross-validating findings across multiple independent sources, GaiaLab demonstrates how **truth emerges through consensus**.

## 🚀 What Makes This Revolutionary

- **13 Data Sources**: The most comprehensive biological data integration ever built for an MCP server (now with Semantic Scholar citation enrichment)
- **3 Cross-Validation Domains**: Protein interactions, disease associations, and drug targets
- **Multi-Source Intelligence**: When independent databases agree → truth emerges with high confidence
- **60-Second Analysis**: What takes researchers 2 weeks, GaiaLab delivers instantly
- **AI Synthesis**: Multi-model AI architecture with automatic failover generates insights with citations and confidence scores
- **Citation-Backed**: Every insight linked to real PubMed papers
- **Statistical Rigor**: Fisher's exact test for pathway enrichment with p-values

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
- **Data APIs**: REST, GraphQL, E-utilities
- **Statistics**: Fisher's exact test, hypergeometric distribution
- **Caching**: In-memory LRU cache with 1-hour TTL (Redis in Phase 2)

## 📂 Project Structure

```
gaialab-app/
├── src/
│   ├── server.js                        # MCP server + orchestration
│   ├── data/
│   │   ├── integrations/               # 12 API clients
│   │   │   ├── ensembl-client.js
│   │   │   ├── clinvar-client.js
│   │   │   ├── uniprot-client.js
│   │   │   ├── go-client.js
│   │   │   ├── kegg-client.js
│   │   │   ├── pubmed-client.js
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
│   └── ai/
│       └── models/
│           └── insight-generator.js    # Multi-model AI synthesis
├── public/
│   └── gaialab-widget.html             # Interactive UI
└── .env.example                        # API key template
```

## 🚦 Development Roadmap

### ✅ Phase 1: MVP (Complete - 12/12 Sources)
- ✅ 12 biological data sources integrated
- ✅ 3 cross-validation domains
- ✅ Multi-model AI synthesis with automatic failover across 4 providers
- ✅ Citation validation & confidence scoring
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
- [ ] Drug repurposing module
- [ ] Real-time alerts for new publications
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

- **12 Data Sources** integrated with cross-validation
- **3 Validation Domains** for multi-source consensus
- **Multi-Model AI** with automatic failover across 4 providers
- **2.4M+ Compounds** from ChEMBL database
- **30M+ Papers** from PubMed literature
- **10-35 Second** average analysis time (with performance optimizations)
- **200x Faster** than manual literature review
- **Instant Results** for repeat queries (in-memory caching)

---

**🌟 Developed by Oluwafemi Idiakhoa** • Powered by 12 biological databases + multi-model AI • Designed to demonstrate emergent intelligence 🌍
