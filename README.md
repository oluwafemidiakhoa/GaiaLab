# GaiaLab: AI-Powered Biological Intelligence Platform 🧬

**Transform gene lists into actionable insights in 60 seconds.**

> 🌟 **Developed by Oluwafemi Idiakhoa** — A revolutionary platform transforming biological research

GaiaLab is a revolutionary MCP (Model Context Protocol) server that integrates real-time biological data from UniProt, KEGG, and PubMed with AI-powered synthesis using Claude 3.5 Sonnet to deliver publication-quality insights for researchers, clinicians, and biotech companies.

## 🚀 What Makes This Revolutionary

- **Real Data Integration**: Pulls live data from UniProt (proteins), KEGG (pathways), PubMed (literature)
- **AI Synthesis**: Claude 3.5 Sonnet generates insights with citations and confidence scores
- **60-Second Insights**: What takes researchers 2 weeks, GaiaLab delivers instantly
- **MCP-Native**: Seamless integration with ChatGPT and Claude
- **Citation-Backed**: Every insight linked to real PubMed papers
- **Statistical Rigor**: Fisher's exact test for pathway enrichment

## 💡 Use Cases

- **Drug Discovery**: Identify therapeutic targets and competing drug candidates
- **Research Intelligence**: Synthesize literature for grant applications and publications
- **Competitive Analysis**: Track clinical trials and emerging drug pipelines
- **Pathway Analysis**: Statistical enrichment analysis with p-values
- **Hypothesis Generation**: AI-powered discovery of novel gene-disease connections

## 📊 Example Analysis

**Input:**
```javascript
genes: ['TP53', 'BRCA1', 'EGFR']
diseaseContext: 'breast cancer'
```

**Output:**
- ✅ Gene function from UniProt
- ✅ Enriched pathways from KEGG with p-values
- ✅ 30 recent PubMed papers
- ✅ AI-synthesized therapeutic insights with citations
- ✅ Confidence scores (low/medium/high)
- ✅ Novel hypotheses

## 🛠️ Installation

### Prerequisites
- Node.js 18+ (ES modules)
- Anthropic API key ([get one here](https://console.anthropic.com/))

### Setup

1. **Clone and install:**
```bash
cd gaialab-app
npm install
```

2. **Configure API keys:**
```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

3. **Run the server:**
```bash
npm start              # Production
npm run dev            # Development (auto-reload)
```

Server will start on `http://localhost:8787`

## 🔑 API Keys

### Required
- **Anthropic API Key** (`ANTHROPIC_API_KEY`): Powers AI synthesis with Claude 3.5 Sonnet
  - Get yours at: https://console.anthropic.com/
  - Cost: ~$0.50 per analysis (varies by complexity)

### Optional
- **NCBI API Key** (`NCBI_API_KEY`): Increases PubMed rate limit from 3/sec to 10/sec
  - Register at: https://www.ncbi.nlm.nih.gov/account/
  - Free for academic/commercial use

## 🧪 Usage with ChatGPT

1. In ChatGPT, add GaiaLab as an MCP server
2. Ask: "Use GaiaLab to analyze TP53 and BRCA1 in breast cancer context"
3. Get instant insights with citations!

## 📈 Data Sources

| Source | Purpose | API |
|--------|---------|-----|
| **UniProt** | Protein function, tissue expression | REST API (free) |
| **KEGG** | Metabolic pathways, gene-pathway mappings | REST API (free for academic) |
| **PubMed** | Biomedical literature (30M+ papers) | E-utilities (free) |
| **Claude 3.5 Sonnet** | AI synthesis, hypothesis generation | Anthropic API ($) |

## 🏗️ Architecture

```
User Input (Genes + Disease)
         ↓
MCP Tool: gaialab_generate_insights
         ↓
[Parallel Data Fetch - ~5 seconds]
  ├─ UniProt: Gene data
  ├─ KEGG: Pathway enrichment
  └─ PubMed: Literature (30 papers)
         ↓
[AI Synthesis - ~10 seconds]
  └─ Claude 3.5 Sonnet
         ↓
Widget Renders: Genes + Pathways + Citations
```

**Total Time:** ~15-20 seconds per analysis

## 💰 Business Model (Path to $1B)

### Freemium SaaS
- **Free**: 10 analyses/month
- **Professional ($99/mo)**: Unlimited analyses, exports
- **Enterprise ($499/mo)**: API access, team workspaces

### Revenue Projections
- **Year 1**: $150K (100 users)
- **Year 2**: $2M (1,000 users + 10 enterprise)
- **Year 3**: $11M (5,000 users + 30 enterprise + pharma partnerships)

### Exit Strategy
- Pharma acquisition: $200M-$500M (Roche, Pfizer)
- Tech acquisition: $300M-$1B (Google Health, Amazon)

## 🔬 Technical Stack

- **Runtime**: Node.js (ES modules)
- **MCP SDK**: @modelcontextprotocol/sdk v1.24.3
- **AI**: Anthropic Claude 3.5 Sonnet
- **Data Integration**: axios, xml2js
- **Statistics**: simple-statistics (Fisher's exact test)

## 📝 Example API Call

```javascript
// MCP Tool Call
{
  "genes": ["TP53", "BRCA1", "EGFR"],
  "diseaseContext": "breast cancer",
  "audience": "researcher"
}

// Response
{
  "genes": [...],  // Full UniProt data
  "pathways": [    // KEGG pathways with p-values
    {
      "name": "DNA damage response",
      "pvalue": 0.0012,
      "confidence": "high",
      "citations": ["PMID:12345678", "PMID:87654321"]
    }
  ],
  "topics": [...], // Literature themes
  "strategies": [...], // Therapeutic insights
  "citations": [...],  // PubMed references
  "dataSource": {
    "genes": "UniProt",
    "pathways": "KEGG",
    "literature": "PubMed",
    "ai": "Claude 3.5 Sonnet"
  }
}
```

## 🚦 Development Roadmap

### ✅ Phase 1: MVP (Complete)
- Real data integration (UniProt, KEGG, PubMed)
- AI synthesis with Claude
- Citation validation
- Confidence scoring

### 🔄 Phase 2: Beta Launch (Months 5-8)
- [ ] Freemium SaaS (Stripe integration)
- [ ] PDF/PowerPoint export
- [ ] Team collaboration features
- [ ] 1,000 users, $10K MRR

### 📅 Phase 3: Growth (Months 9-12)
- [ ] Enterprise API
- [ ] Clinical trial matcher
- [ ] Drug repurposing module
- [ ] 5,000 users, $100K MRR
- [ ] Series A: $5M at $20M-$30M valuation

### 🎯 Phase 4: Scale (Months 13-24)
- [ ] Personalized medicine (HIPAA-compliant)
- [ ] Multi-language support
- [ ] Pharma partnerships
- [ ] 50,000 users, $1M MRR

## 🛡️ Compliance & Safety

- **Research Use Only**: Not for clinical decision-making
- **Citation Required**: Every insight backed by ≥2 PubMed papers
- **Confidence Scores**: Transparent about uncertainty
- **Disclaimers**: Prominent "requires expert validation" warnings

## 🤝 Contributing

This is a commercial project. For partnership inquiries: [contact info]

## 📄 License

Proprietary - All Rights Reserved

## 🙏 Acknowledgments

- UniProt Consortium
- KEGG (Kyoto Encyclopedia of Genes and Genomes)
- NCBI / PubMed
- Anthropic (Claude AI)

---

**🌟 Developed by Oluwafemi Idiakhoa** • Built with Claude Code • Powered by real biological data + AI • Designed to change the world 🌍
