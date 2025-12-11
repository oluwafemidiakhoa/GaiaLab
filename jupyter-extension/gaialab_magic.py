"""
GaiaLab Jupyter Magic Extension
Usage in Jupyter:
    %load_ext gaialab_magic
    %%gaialab TP53, BRCA1, EGFR
    disease: breast cancer
    audience: researcher

Developed by Oluwafemi Idiakhoa
"""

from IPython.core.magic import Magics, magics_class, cell_magic, line_magic
from IPython.display import display, HTML, Markdown
import requests
import json
import pandas as pd

@magics_class
class GaiaLabMagic(Magics):

    def __init__(self, shell):
        super(GaiaLabMagic, self).__init__(shell)
        self.api_url = "http://localhost:8787/analyze"

    @line_magic
    def gaialab_config(self, line):
        """Configure GaiaLab API endpoint
        Usage: %gaialab_config http://localhost:8787/analyze
        """
        self.api_url = line.strip()
        print(f"✅ GaiaLab API configured: {self.api_url}")

    @cell_magic
    def gaialab(self, line, cell):
        """
        Analyze genes with GaiaLab

        Usage:
            %%gaialab TP53, BRCA1, EGFR
            disease: breast cancer
            audience: researcher

        Parameters:
            line: Comma-separated gene symbols
            cell: Key-value pairs (disease, audience, format)
        """
        # Parse genes from line
        genes = [g.strip().upper() for g in line.split(',') if g.strip()]

        if not genes:
            display(HTML('<p style="color:red">❌ Error: No genes provided</p>'))
            return

        # Parse parameters from cell
        params = {}
        for line in cell.strip().split('\n'):
            if ':' in line:
                key, value = line.split(':', 1)
                params[key.strip()] = value.strip()

        disease_context = params.get('disease', 'cancer')
        audience = params.get('audience', 'researcher')
        output_format = params.get('format', 'rich')  # rich, simple, dataframe

        # Display analyzing message
        display(HTML(f'''
            <div style="padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white; border-radius: 10px; margin: 10px 0;">
                <h3>🧬 GaiaLab Analysis</h3>
                <p><strong>Genes:</strong> {", ".join(genes)}</p>
                <p><strong>Context:</strong> {disease_context}</p>
                <p>⏱️ Analyzing... This takes 60-90 seconds</p>
            </div>
        '''))

        try:
            # Call GaiaLab API
            response = requests.post(
                self.api_url,
                json={
                    'genes': genes,
                    'diseaseContext': disease_context,
                    'audience': audience
                },
                timeout=180
            )

            if response.status_code != 200:
                display(HTML(f'<p style="color:red">❌ API Error: {response.status_code}</p>'))
                return

            result = response.json()

            # Display results based on format
            if output_format == 'dataframe':
                self._display_as_dataframe(result)
            elif output_format == 'simple':
                self._display_simple(result, genes, disease_context)
            else:  # rich
                self._display_rich(result, genes, disease_context)

            # Store result in namespace for further analysis
            self.shell.user_ns['gaialab_result'] = result
            display(Markdown('_Results stored in `gaialab_result` variable_'))

        except requests.exceptions.Timeout:
            display(HTML('<p style="color:red">❌ Request timeout. Analysis takes up to 2 minutes.</p>'))
        except Exception as e:
            display(HTML(f'<p style="color:red">❌ Error: {str(e)}</p>'))

    def _display_rich(self, result, genes, disease):
        """Display results in rich HTML format"""
        html = f'''
        <div style="font-family: sans-serif;">
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 15px 0;">
                <h2 style="color: #667eea;">📊 Analysis Complete!</h2>
                <p><strong>Disease Context:</strong> {disease}</p>
                <p><strong>Genes Analyzed:</strong> {len(result.get('genes', []))}</p>
                <p><strong>Pathways Found:</strong> {len(result.get('pathways', []))}</p>
                <p><strong>Papers Reviewed:</strong> {len(result.get('citations', []))}</p>
                <p><strong>Analysis Time:</strong> {result.get('analysisTime', 'N/A')}</p>
                <p><strong>AI Model:</strong> {result.get('dataSource', {}).get('ai', 'GPT-4o')}</p>
            </div>

            <h3 style="color: #667eea;">🧬 Gene Signals</h3>
        '''

        for gene in result.get('genes', [])[:5]:
            importance = int((gene.get('importanceScore', 0)) * 100)
            html += f'''
            <div style="background: white; border-left: 4px solid #667eea; padding: 15px; margin: 10px 0;">
                <h4>{gene.get('symbol')} - {gene.get('name', 'N/A')}</h4>
                <p><em>{gene.get('function', 'No function available')[:200]}...</em></p>
                <p><strong>Importance:</strong> {importance}%</p>
            </div>
            '''

        # Pathways
        significant_pathways = [p for p in result.get('pathways', []) if p.get('significance') == 'significant']
        if significant_pathways:
            html += '<h3 style="color: #667eea;">🔬 Significant Pathways (p < 0.05)</h3>'
            for pathway in significant_pathways[:5]:
                pvalue = pathway.get('pvalue', 0)
                html += f'''
                <div style="background: white; border-left: 4px solid #667eea; padding: 15px; margin: 10px 0;">
                    <h4>{pathway.get('name')}</h4>
                    <p><strong>P-value:</strong> <code>{pvalue:.2e}</code></p>
                    <p><strong>Confidence:</strong> {pathway.get('confidence', 'N/A').upper()}</p>
                    <p>{pathway.get('rationale', '')[:200]}...</p>
                </div>
                '''

        # Therapeutic insights
        therapeutics = result.get('strategies', [])
        if therapeutics:
            html += '<h3 style="color: #667eea;">💊 Therapeutic Insights</h3>'
            for strategy in therapeutics[:3]:
                html += f'''
                <div style="background: white; border-left: 4px solid #667eea; padding: 15px; margin: 10px 0;">
                    <h4>{strategy.get('label')}</h4>
                    <p><strong>Risk:</strong> {strategy.get('riskLevel', 'N/A').upper()} |
                       <strong>Confidence:</strong> {strategy.get('confidence', 'N/A').upper()}</p>
                    <p>{strategy.get('rationale', '')[:200]}...</p>
                </div>
                '''

        html += '''
            <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin: 20px 0; text-align: center;">
                <p style="color: #666; margin: 5px 0;">
                    ⚠️ <strong>Research Use Only:</strong> AI-generated insights require expert validation
                </p>
                <p style="color: #999; font-size: 12px; margin: 5px 0;">
                    🌟 Developed by Oluwafemi Idiakhoa | Powered by UniProt, KEGG, PubMed & AI
                </p>
            </div>
        </div>
        '''

        display(HTML(html))

    def _display_simple(self, result, genes, disease):
        """Display results in simple text format"""
        print(f"\n📊 GaiaLab Analysis: {disease}")
        print("=" * 70)
        print(f"Genes: {', '.join([g.get('symbol') for g in result.get('genes', [])])}")
        print(f"Pathways: {len(result.get('pathways', []))}")
        print(f"Papers: {len(result.get('citations', []))}")
        print(f"Time: {result.get('analysisTime', 'N/A')}")
        print("\n🔬 Top Pathways:")
        for i, pathway in enumerate(result.get('pathways', [])[:5], 1):
            print(f"{i}. {pathway.get('name')} (p={pathway.get('pvalue', 0):.2e})")

    def _display_as_dataframe(self, result):
        """Display results as pandas DataFrames"""
        # Genes DataFrame
        genes_data = []
        for gene in result.get('genes', []):
            genes_data.append({
                'Symbol': gene.get('symbol'),
                'Name': gene.get('name'),
                'Importance': f"{gene.get('importanceScore', 0) * 100:.0f}%",
                'UniProt': gene.get('uniprotId')
            })

        if genes_data:
            print("\n🧬 GENES:")
            display(pd.DataFrame(genes_data))

        # Pathways DataFrame
        pathways_data = []
        for pathway in result.get('pathways', [])[:10]:
            pathways_data.append({
                'Pathway': pathway.get('name'),
                'P-value': pathway.get('pvalue', 0),
                'Significance': pathway.get('significance'),
                'Confidence': pathway.get('confidence'),
                'Genes': len(pathway.get('genesInPathway', []))
            })

        if pathways_data:
            print("\n🔬 PATHWAYS:")
            display(pd.DataFrame(pathways_data))

def load_ipython_extension(ipython):
    """Load the extension in IPython"""
    ipython.register_magics(GaiaLabMagic)
    print("✅ GaiaLab Jupyter extension loaded!")
    print("   Usage: %%gaialab TP53, BRCA1")
    print("          disease: breast cancer")
