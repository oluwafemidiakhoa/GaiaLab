# GaiaLab Jupyter Extension Setup Guide 🧬

**Bring AI-powered biological intelligence directly into your Jupyter notebooks!**

Analyze genes with a simple cell magic: `%%gaialab TP53, BRCA1` - get rich HTML results + exportable DataFrames.

---

## What You'll Get

- **Cell Magic**: `%%gaialab TP53, BRCA1, EGFR`
- **Rich HTML Output**: Beautiful formatted results in notebooks
- **DataFrame Export**: Convert to pandas for further analysis
- **Auto-Save Results**: Access via `gaialab_result` variable
- **Multiple Formats**: Rich HTML, simple text, or DataFrames

---

## Prerequisites

- Python 3.8+ with Jupyter installed
- GaiaLab server running (http://localhost:8787 or deployed URL)
- `pip` package manager

---

## Step 1: Install Dependencies

```bash
# Install IPython and required packages
pip install ipython jupyter pandas requests
```

---

## Step 2: Install GaiaLab Extension

### Option A: Install from Local File

```bash
# Copy extension to Jupyter extensions directory
mkdir -p ~/.ipython/extensions
cp jupyter-extension/gaialab_magic.py ~/.ipython/extensions/
```

### Option B: Install via pip (if packaged)

```bash
pip install gaialab-jupyter
```

---

## Step 3: Start GaiaLab Server

In a separate terminal:

```bash
cd gaialab-app
npm start
```

Server should be running on `http://localhost:8787`

---

## Step 4: Load Extension in Jupyter

### In a Jupyter Notebook

```python
# Load the extension
%load_ext gaialab_magic
```

You should see:
```
✅ GaiaLab Jupyter extension loaded!
   Usage: %%gaialab TP53, BRCA1
          disease: breast cancer
```

---

## Step 5: Run Your First Analysis

```python
%%gaialab TP53, BRCA1, EGFR
disease: breast cancer
audience: researcher
```

**Analysis will take 60-90 seconds** - it's fetching data from UniProt, KEGG, PubMed + AI synthesis!

---

## Usage Examples

### Basic Analysis
```python
%%gaialab TP53, BRCA1
disease: breast cancer
audience: researcher
```

### Single Gene
```python
%%gaialab TP53
disease: cancer
audience: researcher
```

### Custom Output Format (Simple Text)
```python
%%gaialab KRAS, NRAS, BRAF
disease: colorectal cancer
audience: clinician
format: simple
```

### DataFrame Output
```python
%%gaialab APOE, APP, PSEN1
disease: Alzheimer's disease
audience: researcher
format: dataframe
```

---

## Output Formats

### 1. Rich HTML (Default)
Beautiful formatted results with:
- 📊 Analysis summary (genes, pathways, papers, time)
- 🧬 Gene signals with importance scores
- 🔬 Significant pathways (p < 0.05)
- 💊 Therapeutic insights with confidence
- ⚠️ Research disclaimer

```python
%%gaialab TP53, BRCA1
disease: breast cancer
format: rich
```

### 2. Simple Text
Plain text output for quick scanning:
```python
%%gaialab TP53, BRCA1
disease: breast cancer
format: simple
```

Output:
```
📊 GaiaLab Analysis: breast cancer
======================================================================
Genes: TP53, BRCA1
Pathways: 20
Papers: 30
Time: 72.3s

🔬 Top Pathways:
1. DNA damage response (p=1.2e-08)
2. Cell cycle regulation (p=3.4e-06)
3. Apoptosis signaling (p=7.8e-05)
```

### 3. DataFrames
Export to pandas for further analysis:
```python
%%gaialab TP53, BRCA1, EGFR
disease: breast cancer
format: dataframe
```

Output:
```
🧬 GENES:
   Symbol                        Name  Importance UniProt
0    TP53          Tumor protein p53         95%  P04637
1   BRCA1  Breast cancer type 1...         92%  P38398
2    EGFR  Epidermal growth factor...   88%  P00533

🔬 PATHWAYS:
                           Pathway   P-value Significance Confidence  Genes
0      DNA damage response and repair  1.2e-08   significant       high     12
1           Cell cycle regulation      3.4e-06   significant       high      8
2              Apoptosis signaling     7.8e-05   significant     medium      6
```

---

## Access Results Programmatically

All results are auto-saved to `gaialab_result` variable:

```python
%%gaialab TP53, BRCA1
disease: breast cancer
```

Then:
```python
# Access the full result
result = gaialab_result

# Extract genes
genes = result['genes']
for gene in genes:
    print(f"{gene['symbol']}: {gene['name']}")

# Extract pathways
pathways = result['pathways']
significant = [p for p in pathways if p['significance'] == 'significant']
print(f"Found {len(significant)} significant pathways")

# Extract citations
citations = result['citations']
pmids = [c['pmid'] for c in citations]
print(f"PubMed IDs: {', '.join(pmids)}")

# Convert to DataFrame
import pandas as pd
df_genes = pd.DataFrame(genes)
df_pathways = pd.DataFrame(pathways)
```

---

## Advanced Usage

### Configure API Endpoint

If your server is on a different port or remote:

```python
%gaialab_config http://localhost:8787/analyze
```

Or for remote server:
```python
%gaialab_config https://gaialab.yourcompany.com/analyze
```

### Multiple Analyses in One Notebook

```python
# Analysis 1: Breast cancer genes
%%gaialab TP53, BRCA1, BRCA2
disease: breast cancer

# Save results
breast_cancer_result = gaialab_result

# Analysis 2: Lung cancer genes
%%gaialab KRAS, EGFR, ALK
disease: lung cancer

# Save results
lung_cancer_result = gaialab_result

# Compare
print(f"Breast cancer pathways: {len(breast_cancer_result['pathways'])}")
print(f"Lung cancer pathways: {len(lung_cancer_result['pathways'])}")
```

### Export to CSV

```python
%%gaialab TP53, BRCA1, EGFR
disease: breast cancer

# Export genes to CSV
import pandas as pd
genes_df = pd.DataFrame(gaialab_result['genes'])
genes_df.to_csv('gaialab_genes.csv', index=False)

# Export pathways
pathways_df = pd.DataFrame(gaialab_result['pathways'])
pathways_df.to_csv('gaialab_pathways.csv', index=False)
```

### Visualize Results

```python
%%gaialab TP53, BRCA1, EGFR, KRAS
disease: cancer

# Plot gene importance
import matplotlib.pyplot as plt
import pandas as pd

genes = gaialab_result['genes']
symbols = [g['symbol'] for g in genes]
importance = [g['importanceScore'] * 100 for g in genes]

plt.figure(figsize=(10, 6))
plt.barh(symbols, importance, color='#667eea')
plt.xlabel('Importance Score (%)')
plt.title('Gene Importance in Cancer Context')
plt.tight_layout()
plt.show()

# Plot pathway significance
pathways = gaialab_result['pathways'][:10]
pathway_names = [p['name'][:30] + '...' for p in pathways]
pvalues = [-np.log10(p['pvalue']) for p in pathways]

plt.figure(figsize=(10, 8))
plt.barh(pathway_names, pvalues, color='#764ba2')
plt.xlabel('-log10(p-value)')
plt.title('Top 10 Enriched Pathways')
plt.axvline(x=-np.log10(0.05), color='red', linestyle='--', label='p=0.05')
plt.legend()
plt.tight_layout()
plt.show()
```

---

## Example Notebook

Here's a complete example notebook:

```python
# Cell 1: Load extension
%load_ext gaialab_magic
print("✅ GaiaLab loaded!")

# Cell 2: Analyze breast cancer genes
%%gaialab TP53, BRCA1, BRCA2, EGFR
disease: breast cancer
audience: researcher

# Cell 3: Extract significant pathways
significant_pathways = [
    p for p in gaialab_result['pathways']
    if p['significance'] == 'significant'
]
print(f"Found {len(significant_pathways)} significant pathways:")
for p in significant_pathways[:5]:
    print(f"  - {p['name']} (p={p['pvalue']:.2e})")

# Cell 4: Export to CSV
import pandas as pd
pd.DataFrame(gaialab_result['genes']).to_csv('genes.csv')
pd.DataFrame(gaialab_result['pathways']).to_csv('pathways.csv')
print("✅ Exported to genes.csv and pathways.csv")

# Cell 5: Visualize
import matplotlib.pyplot as plt
import numpy as np

pathways = gaialab_result['pathways'][:10]
names = [p['name'][:40] for p in pathways]
pvalues = [-np.log10(p['pvalue']) for p in pathways]

plt.figure(figsize=(12, 6))
plt.barh(names, pvalues, color='#667eea')
plt.xlabel('-log10(p-value)', fontsize=12)
plt.title('Top 10 Enriched Pathways in Breast Cancer', fontsize=14)
plt.axvline(x=-np.log10(0.05), color='red', linestyle='--', label='p=0.05')
plt.legend()
plt.tight_layout()
plt.show()
```

---

## Troubleshooting

### Extension Not Loading
```python
%load_ext gaialab_magic
# ModuleNotFoundError: No module named 'gaialab_magic'
```

**Fix**:
1. Check file exists:
   ```bash
   ls ~/.ipython/extensions/gaialab_magic.py
   ```

2. Or load from current directory:
   ```python
   import sys
   sys.path.insert(0, './jupyter-extension')
   %load_ext gaialab_magic
   ```

### Connection Refused
```python
%%gaialab TP53
# ❌ Error: Connection refused
```

**Fix**: Start GaiaLab server first:
```bash
cd gaialab-app
npm start
```

### Timeout Error
```python
%%gaialab TP53, BRCA1, EGFR
# ❌ Request timeout. Analysis takes up to 2 minutes.
```

**Fix**: This is normal for large analyses! Wait 60-90 seconds. If >2 minutes:
1. Check server logs for errors
2. Verify API keys in `.env`
3. Check network connectivity

### No Genes Provided
```python
%%gaialab
disease: breast cancer
# ❌ Error: No genes provided
```

**Fix**: Genes must be on the first line:
```python
%%gaialab TP53, BRCA1
disease: breast cancer
```

---

## Integration with Other Tools

### With BioPython
```python
%%gaialab TP53
disease: cancer

# Get UniProt IDs
from Bio import Entrez, SeqIO
uniprot_id = gaialab_result['genes'][0]['uniprotId']
# Fetch sequences...
```

### With PubMed (Entrez)
```python
%%gaialab TP53, BRCA1
disease: breast cancer

# Extract PMIDs
pmids = [c['pmid'] for c in gaialab_result['citations']]

# Fetch abstracts
from Bio import Entrez
Entrez.email = "your@email.com"
for pmid in pmids[:5]:
    handle = Entrez.efetch(db="pubmed", id=pmid, retmode="xml")
    records = Entrez.read(handle)
    article = records['PubmedArticle'][0]['MedlineCitation']['Article']
    print(f"PMID:{pmid} - {article['ArticleTitle']}")
```

### With Plotly (Interactive Viz)
```python
%%gaialab TP53, BRCA1, EGFR, KRAS
disease: cancer

import plotly.express as px
import pandas as pd

# Create interactive pathway plot
pathways_df = pd.DataFrame(gaialab_result['pathways'][:15])
pathways_df['neg_log_pvalue'] = -np.log10(pathways_df['pvalue'])

fig = px.bar(
    pathways_df,
    x='neg_log_pvalue',
    y='name',
    color='confidence',
    title='Enriched Pathways (Interactive)',
    labels={'neg_log_pvalue': '-log10(p-value)'},
    hover_data=['pvalue', 'genesInPathway']
)
fig.add_vline(x=-np.log10(0.05), line_dash="dash", line_color="red")
fig.show()
```

---

## Auto-Load Extension

To load GaiaLab automatically in all notebooks:

1. Create IPython startup script:
   ```bash
   mkdir -p ~/.ipython/profile_default/startup
   nano ~/.ipython/profile_default/startup/00-gaialab.py
   ```

2. Add:
   ```python
   try:
       get_ipython().magic('load_ext gaialab_magic')
       print("✅ GaiaLab auto-loaded")
   except:
       pass
   ```

3. Now every Jupyter session will have GaiaLab ready!

---

## Performance Tips

### Reduce Analysis Time
```python
# Reduce max papers (default: 30)
# This is not currently exposed, but you can modify gaialab_magic.py
```

### Cache Results
```python
# Store results for reuse
analyses_cache = {}

def analyze_with_cache(genes, disease):
    key = f"{','.join(genes)}_{disease}"
    if key in analyses_cache:
        print("✅ Using cached result")
        return analyses_cache[key]

    # Run analysis (manually call API)
    import requests
    result = requests.post('http://localhost:8787/analyze', json={
        'genes': genes,
        'diseaseContext': disease
    }).json()

    analyses_cache[key] = result
    return result
```

---

## Example Research Workflows

### 1. Comparative Cancer Analysis
```python
# Analyze multiple cancer types
cancers = ['breast cancer', 'lung cancer', 'colorectal cancer']
genes = ['TP53', 'KRAS', 'EGFR']

results = {}
for cancer in cancers:
    # Note: You'd need to manually format this as %%gaialab doesn't support loops
    # Or use the HTTP API directly
    pass
```

### 2. Pathway Enrichment Pipeline
```python
# 1. Analyze genes
%%gaialab TP53, BRCA1, ATM, CHEK2
disease: breast cancer

# 2. Filter significant pathways
sig_pathways = [p for p in gaialab_result['pathways'] if p['pvalue'] < 0.01]

# 3. Export for GSEA
import pandas as pd
pd.DataFrame(sig_pathways).to_csv('enriched_pathways_gsea.csv')
```

### 3. Literature Mining
```python
# Analyze genes
%%gaialab TP53, BRCA1
disease: breast cancer

# Extract all citations
citations = gaialab_result['citations']
print(f"Found {len(citations)} recent papers")

# Group by year
from collections import Counter
years = [c['year'] for c in citations]
print(Counter(years))
```

---

## Cost Optimization

Each analysis costs ~$0.50 (API calls to Claude/GPT-4 + databases). To reduce costs:

1. **Cache results** (see above)
2. **Use smaller gene sets** (3-5 genes instead of 10+)
3. **Batch analyses** (run multiple in one session)
4. **Share results** with team (don't re-run same analysis)

---

## Publishing Results

### In Papers
```
Methods: Gene set enrichment analysis was performed using GaiaLab
(Idiakhoa, 2024), which integrates data from UniProt, KEGG, and
PubMed with AI-powered synthesis via GPT-4o. Statistical significance
was assessed using hypergeometric test (p < 0.05).
```

### In Notebooks
All outputs are already publication-quality! Use:
- **Rich HTML** for presentations
- **DataFrames** for tables in papers
- **Matplotlib/Plotly** for figures

---

## Support

- **Documentation**: https://github.com/your-repo/gaialab
- **Issues**: https://github.com/your-repo/gaialab/issues
- **Email**: support@gaialab.ai

---

**🌟 Developed by Oluwafemi Idiakhoa** | Built with Claude Code | Powered by IPython + AI
