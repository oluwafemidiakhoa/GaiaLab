# GaiaLab Slack Bot Setup Guide 🧬

**Transform your Slack workspace into a biological intelligence hub!**

Analyze genes directly in Slack with `/gaialab TP53, BRCA1 in breast cancer` - get insights in 60-90 seconds.

---

## What You'll Get

- **Slash Command**: `/gaialab TP53, BRCA1 in breast cancer`
- **App Mentions**: `@gaialab analyze KRAS in colorectal cancer`
- **Rich Results**: Genes, pathways (with p-values), therapeutic insights
- **Team Collaboration**: Share analyses in channels
- **Publication-Ready**: Click "View Full Report" for detailed analysis

---

## Prerequisites

- Slack workspace (admin access to install apps)
- GaiaLab server running (http://localhost:8787 or deployed URL)
- Node.js 18+ installed

---

## Step 1: Install Required Package

```bash
cd gaialab-app
npm install @slack/bolt
```

---

## Step 2: Create Slack App

### 2.1 Go to Slack API Dashboard
1. Visit: https://api.slack.com/apps
2. Click **"Create New App"**
3. Select **"From scratch"**
4. **App Name**: `GaiaLab`
5. **Workspace**: Select your workspace
6. Click **"Create App"**

### 2.2 Enable Socket Mode
1. In your app dashboard, go to **Settings → Socket Mode**
2. **Enable Socket Mode**
3. **Token Name**: `GaiaLab Socket Token`
4. Click **"Generate"**
5. **Copy the token** (starts with `xapp-`) → Save as `SLACK_APP_TOKEN`

### 2.3 Configure Bot Token Scopes
1. Go to **OAuth & Permissions**
2. Scroll to **"Scopes" → "Bot Token Scopes"**
3. Add these scopes:
   - `app_mentions:read` - Read messages that mention @gaialab
   - `chat:write` - Send messages
   - `commands` - Add slash commands
   - `channels:history` - Read channel messages
   - `groups:history` - Read private channel messages

4. Click **"Install to Workspace"**
5. Click **"Allow"**
6. **Copy the "Bot User OAuth Token"** (starts with `xoxb-`) → Save as `SLACK_BOT_TOKEN`

### 2.4 Get Signing Secret
1. Go to **Settings → Basic Information**
2. Scroll to **"App Credentials"**
3. **Copy "Signing Secret"** → Save as `SLACK_SIGNING_SECRET`

### 2.5 Create Slash Command
1. Go to **Features → Slash Commands**
2. Click **"Create New Command"**
3. Fill in:
   - **Command**: `/gaialab`
   - **Request URL**: `https://your-domain.com/slack/events` (Socket Mode doesn't need this, but it's required - use any URL)
   - **Short Description**: `Analyze genes with AI-powered biological intelligence`
   - **Usage Hint**: `TP53, BRCA1 in breast cancer`
4. Click **"Save"**

### 2.6 Subscribe to Events
1. Go to **Features → Event Subscriptions**
2. **Enable Events**: Toggle ON
3. **Request URL**: Leave blank (Socket Mode handles this)
4. Scroll to **"Subscribe to bot events"**
5. Add these events:
   - `app_mention` - When someone mentions @gaialab
6. Click **"Save Changes"**

---

## Step 3: Configure Environment Variables

Add to your `.env` file:

```bash
# Slack Bot Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token

# GaiaLab URL (for "View Full Report" button)
GAIALAB_URL=http://localhost:8787  # Change to your deployed URL in production
```

---

## Step 4: Integrate with Main Server

Edit `src/server.js` to start the Slack bot:

```javascript
// Add import at top
import { startSlackBot } from './integrations/slack-bot.js';

// Add after MCP server starts (around line 360)
// Start Slack Bot (if configured)
startSlackBot();
```

---

## Step 5: Start the Server

```bash
npm start
```

You should see:
```
✅ GaiaLab MCP Server running on http://localhost:8787
⚡ GaiaLab Slack Bot is running!
   Use: /gaialab TP53, BRCA1 in breast cancer
```

---

## Step 6: Test in Slack

### Test Slash Command
In any Slack channel:
```
/gaialab TP53, BRCA1, EGFR in breast cancer
```

You'll see:
1. **Loading message** (60-90 seconds)
2. **Rich results** with:
   - 🧬 Genes analyzed with importance scores
   - 🔬 Significant pathways (p < 0.05)
   - 💊 Therapeutic insights with citations
   - 📊 "View Full Report" button

### Test App Mention
In any channel where @gaialab is invited:
```
@gaialab analyze KRAS, NRAS, BRAF in colorectal cancer
```

---

## Usage Examples

### Simple Query
```
/gaialab TP53 in cancer
```

### Multiple Genes
```
/gaialab TP53, BRCA1, BRCA2, EGFR in breast cancer
```

### Different Disease Context
```
/gaialab KRAS, BRAF, NRAS for melanoma
```

### App Mention
```
@gaialab analyze APOE in Alzheimer's disease
```

---

## Example Slack Output

```
🧬 GaiaLab Analysis: breast cancer
✅ Analyzed 3 genes in 72.5s | AI: GPT-4o

─────────────────────────────────────

🧬 Genes Analyzed:
• TP53: Tumor protein p53
  Importance: 95%
• BRCA1: Breast cancer type 1 susceptibility protein
  Importance: 92%
• EGFR: Epidermal growth factor receptor
  Importance: 88%

─────────────────────────────────────

🔬 Significant Pathways (p < 0.05):
1. DNA damage response and repair
   p-value: 1.2e-08 | 12 genes

2. Cell cycle regulation
   p-value: 3.4e-06 | 8 genes

3. Apoptosis signaling
   p-value: 7.8e-05 | 6 genes

─────────────────────────────────────

💊 Therapeutic Insights:
1. PARP inhibitors for BRCA1-deficient tumors
   Risk: LOW | Confidence: HIGH
   FDA-approved olaparib shows 70% response rate in BRCA1-mutant breast cancer (PMID:12345678)...

2. EGFR tyrosine kinase inhibitors
   Risk: MEDIUM | Confidence: HIGH
   Gefitinib and erlotinib target EGFR-driven proliferation (PMID:87654321)...

[📊 View Full Report]

─────────────────────────────────────
Powered by UniProt, KEGG, PubMed & AI | ⚠️ Research use only
```

---

## Troubleshooting

### Bot Not Responding
1. Check environment variables are set:
   ```bash
   node -e "require('dotenv').config(); console.log('Bot Token:', process.env.SLACK_BOT_TOKEN?.substring(0, 10) + '...'); console.log('App Token:', process.env.SLACK_APP_TOKEN?.substring(0, 10) + '...');"
   ```

2. Check server logs:
   ```
   [Slack Bot] Disabled (no SLACK_BOT_TOKEN)  ❌ Token missing!
   ⚡ GaiaLab Slack Bot is running!           ✅ Working!
   ```

### "Dispatch Failed" Error
- **Cause**: Socket Mode not enabled
- **Fix**: Go to Slack API → Socket Mode → Enable

### Slash Command Not Appearing
1. Reinstall app: **OAuth & Permissions → Reinstall App**
2. Check command is created: **Slash Commands**
3. Try typing `/gaialab` in Slack search

### Analysis Times Out
- Normal analysis takes 60-90 seconds
- If >2 minutes, check:
  1. API keys in `.env` (OpenAI, Anthropic, Google)
  2. Server logs for errors
  3. Network connectivity to PubMed, UniProt, KEGG

### "Invalid Format" Error
- **Correct**: `/gaialab TP53, BRCA1 in breast cancer`
- **Incorrect**: `/gaialab TP53 BRCA1` (missing "in" or "for")
- **Incorrect**: `/gaialab in breast cancer` (missing genes)

---

## Advanced Configuration

### Custom Button URL (Production)
Set `GAIALAB_URL` in `.env` to your deployed domain:
```bash
GAIALAB_URL=https://gaialab.yourcompany.com
```

### Rate Limiting (Prevent Abuse)
Add to `slack-bot.js`:
```javascript
const rateLimit = new Map();
const MAX_REQUESTS_PER_HOUR = 10;

// In slash command handler
const userId = command.user_id;
const now = Date.now();
const userRequests = rateLimit.get(userId) || [];
const recentRequests = userRequests.filter(t => now - t < 3600000); // Last hour

if (recentRequests.length >= MAX_REQUESTS_PER_HOUR) {
  await say({
    text: `⚠️ Rate limit: ${MAX_REQUESTS_PER_HOUR} analyses/hour. Try again later.`,
    response_type: 'ephemeral'
  });
  return;
}

rateLimit.set(userId, [...recentRequests, now]);
```

### Team Analytics (Track Usage)
Log to database:
```javascript
await db.logSlackAnalysis({
  userId: command.user_id,
  channelId: command.channel_id,
  genes,
  diseaseContext,
  analysisTime,
  timestamp: new Date()
});
```

---

## Production Deployment

### Deploy to Heroku
```bash
# Install Heroku CLI
heroku create gaialab-slack-bot

# Set environment variables
heroku config:set SLACK_BOT_TOKEN=xoxb-...
heroku config:set SLACK_APP_TOKEN=xapp-...
heroku config:set SLACK_SIGNING_SECRET=...
heroku config:set ANTHROPIC_API_KEY=...
heroku config:set OPENAI_API_KEY=...
heroku config:set GAIALAB_URL=https://gaialab-slack-bot.herokuapp.com

# Deploy
git push heroku main
```

### Deploy to AWS Lambda (Serverless)
Use Slack Bolt's AWS Lambda adapter:
```javascript
import { AwsLambdaReceiver } from '@slack/bolt';

const awsLambdaReceiver = new AwsLambdaReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: awsLambdaReceiver,
});
```

---

## Cost Estimation

### Per Analysis
- **API Costs**: ~$0.50 (Claude/GPT-4 + data fetching)
- **Compute**: Minimal (<$0.01)
- **Total**: ~$0.50-$0.60 per analysis

### Monthly (100 analyses/month)
- **API**: $50-$60
- **Heroku/AWS**: $7-$25
- **Total**: ~$75/month

### Monetization Ideas
1. **Freemium**: 10 free analyses/user/month, $10/user for unlimited
2. **Enterprise**: $500/month for unlimited team access
3. **API Access**: $100/month for programmatic access

---

## Security Best Practices

1. **Never commit tokens to git**:
   ```bash
   echo ".env" >> .gitignore
   ```

2. **Rotate tokens regularly** (every 90 days)

3. **Use separate workspaces** for dev/staging/production

4. **Enable audit logs** (Slack Enterprise Grid)

5. **Validate Slack signatures** (already handled by Bolt)

---

## Support

- **Issues**: https://github.com/your-repo/gaialab/issues
- **Slack Community**: [Your Slack channel]
- **Email**: support@gaialab.ai

---

Built with Claude Code | Powered by Slack Bolt API
