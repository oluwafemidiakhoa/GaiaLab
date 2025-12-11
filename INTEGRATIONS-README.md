# GaiaLab Integrations Overview 🧬

**Two powerful integrations to bring AI-powered biological intelligence to your team's workflow!**

---

## What's Available

### 1. Slack Bot Integration 💬
Analyze genes directly in Slack channels with `/gaialab` commands.

**Status**: ✅ **Code complete** - Needs setup and testing

**Setup Guide**: [SLACK-BOT-SETUP.md](SLACK-BOT-SETUP.md)

### 2. Jupyter Notebook Extension 📊
Run gene analysis directly in notebooks with `%%gaialab` cell magic.

**Status**: ✅ **Code complete** - Needs installation and testing

**Setup Guide**: [JUPYTER-SETUP.md](JUPYTER-SETUP.md)

---

## Quick Start

### Option 1: Slack Bot (Team Collaboration)

```bash
# 1. Install package
npm install @slack/bolt

# 2. Configure Slack app (see SLACK-BOT-SETUP.md)
# Get: SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SLACK_SIGNING_SECRET

# 3. Add to .env
echo "SLACK_BOT_TOKEN=xoxb-your-token" >> .env
echo "SLACK_APP_TOKEN=xapp-your-token" >> .env
echo "SLACK_SIGNING_SECRET=your-secret" >> .env

# 4. Integrate with main server (see guide)
# Edit src/server.js to call startSlackBot()

# 5. Start server
npm start
```

**Usage in Slack**:
```
/gaialab TP53, BRCA1 in breast cancer
```

---

### Option 2: Jupyter Extension (Research Notebooks)

```bash
# 1. Install Python dependencies
pip install ipython jupyter pandas requests

# 2. Copy extension
cp jupyter-extension/gaialab_magic.py ~/.ipython/extensions/

# 3. Start GaiaLab server
npm start

# 4. Load in Jupyter
%load_ext gaialab_magic
```

**Usage in Jupyter**:
```python
%%gaialab TP53, BRCA1, EGFR
disease: breast cancer
audience: researcher
```

---

## Issues Fixed in Slack Bot ✅

Your instinct was right - there were several issues! Here's what I fixed:

### 1. Missing dotenv Import ❌ → ✅
**Problem**: Environment variables wouldn't load
```javascript
// BEFORE
import { App } from '@slack/bolt';

// AFTER
import 'dotenv/config'; // Load environment variables
import { App } from '@slack/bolt';
```

### 2. Missing @slack/bolt Package ❌ → ✅
**Problem**: Import would fail
```bash
# FIX
npm install @slack/bolt
```

### 3. Hardcoded Localhost URL ❌ → ✅
**Problem**: "View Full Report" button wouldn't work in production
```javascript
// BEFORE
url: `http://localhost:8787/?genes=...`

// AFTER
url: `${process.env.GAIALAB_URL || 'http://localhost:8787'}/?genes=...`
```

### 4. Missing Error Handling ❌ → ✅
**Problem**: App mention event could crash without try/catch
```javascript
// BEFORE
slackApp.event('app_mention', async ({ event, say }) => {
  // No error handling
});

// AFTER
slackApp.event('app_mention', async ({ event, say }) => {
  try {
    // Code...
  } catch (error) {
    console.error('[Slack Bot] App mention error:', error);
    await say(`❌ Error: ${error.message}`);
  }
});
```

### 5. Unused Variable Warning ❌ → ✅
**Problem**: IDE warning about unused `userId`
```javascript
// BEFORE
const userId = command.user_id; // Not used

// AFTER
// Removed - not needed yet (add back when implementing rate limiting)
```

---

## File Structure

```
gaialab-app/
├── src/
│   └── integrations/
│       └── slack-bot.js          ✅ Fixed and ready
├── jupyter-extension/
│   └── gaialab_magic.py          ✅ Complete
├── SLACK-BOT-SETUP.md            ✅ Comprehensive guide
├── JUPYTER-SETUP.md              ✅ Comprehensive guide
└── INTEGRATIONS-README.md        📄 This file
```

---

## What You Need to Do

### For Slack Bot:

1. **Install @slack/bolt**:
   ```bash
   npm install @slack/bolt
   ```

2. **Create Slack App** (5 minutes):
   - Go to https://api.slack.com/apps
   - Follow steps in [SLACK-BOT-SETUP.md](SLACK-BOT-SETUP.md)
   - Get 3 tokens: SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SLACK_SIGNING_SECRET

3. **Add Tokens to .env**:
   ```bash
   SLACK_BOT_TOKEN=xoxb-...
   SLACK_APP_TOKEN=xapp-...
   SLACK_SIGNING_SECRET=...
   ```

4. **Integrate with Server**:
   Edit `src/server.js` and add:
   ```javascript
   // Add import at top
   import { startSlackBot } from './integrations/slack-bot.js';

   // Add after "MCP Server running" message (around line 360)
   startSlackBot();
   ```

5. **Test**:
   ```bash
   npm start
   # Should see: ⚡ GaiaLab Slack Bot is running!
   ```

   Then in Slack:
   ```
   /gaialab TP53, BRCA1 in breast cancer
   ```

---

### For Jupyter Extension:

1. **Install Python packages**:
   ```bash
   pip install ipython jupyter pandas requests
   ```

2. **Copy extension**:
   ```bash
   mkdir -p ~/.ipython/extensions
   cp jupyter-extension/gaialab_magic.py ~/.ipython/extensions/
   ```

3. **Start server**:
   ```bash
   npm start
   ```

4. **Test in Jupyter**:
   ```python
   %load_ext gaialab_magic

   %%gaialab TP53, BRCA1
   disease: breast cancer
   ```

---

## Use Cases

### Slack Bot 💬
- **Team Collaboration**: Share analyses in channels
- **Quick Lookups**: `/gaialab KRAS in lung cancer` during meetings
- **Research Discussions**: Instant insights for paper discussions
- **Client Presentations**: Impress with real-time analysis

### Jupyter Extension 📊
- **Research Workflows**: Integrate with pandas, matplotlib, seaborn
- **Reproducible Science**: Document analysis in notebooks
- **Data Exploration**: Iterative hypothesis testing
- **Publication Figures**: Generate plots for papers

---

## Cost Estimation

Each analysis costs ~$0.50 (API calls to GPT-4o/Claude + databases)

### Slack Bot (Team of 10)
- 50 analyses/month: **$25/month**
- 200 analyses/month: **$100/month**

### Jupyter Extension (Individual Researcher)
- 20 analyses/month: **$10/month**
- 100 analyses/month: **$50/month**

**Optimization**: Results are cached for 15 minutes - repeated queries are free!

---

## Troubleshooting

### Slack Bot Not Responding
```bash
# Check environment variables
node -e "require('dotenv').config(); console.log('Bot:', process.env.SLACK_BOT_TOKEN?.substring(0,10));"
```

### Jupyter Extension Not Loading
```python
# Load from current directory
import sys
sys.path.insert(0, './jupyter-extension')
%load_ext gaialab_magic
```

### Analysis Timeout (>2 minutes)
- Check API keys in `.env`
- Check server logs: `npm start`
- Normal time: 60-90 seconds

---

## Next Steps

1. **Choose your integration** (or both!)
2. **Follow the setup guide**:
   - [SLACK-BOT-SETUP.md](SLACK-BOT-SETUP.md) (15 minutes)
   - [JUPYTER-SETUP.md](JUPYTER-SETUP.md) (5 minutes)
3. **Test with example queries**
4. **Share with team** or **use in research**!

---

## Support

- **Setup Issues**: See detailed guides above
- **Bugs**: I can help fix them! (As you just saw 😄)
- **Feature Requests**: Let me know what you need
- **Questions**: Ask anytime!

---

**🌟 Developed by Oluwafemi Idiakhoa** | Built with Claude Code | Ready to deploy!
