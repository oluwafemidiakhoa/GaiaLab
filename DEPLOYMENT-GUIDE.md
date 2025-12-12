# GaiaLab Deployment Guide 🚀

**Make GaiaLab accessible to the world in 10 minutes!**

Your code is on GitHub (private), but it's only running on your computer. This guide shows you how to deploy it to the cloud so **anyone** can use it.

---

## 🎯 **What You'll Get**

- **Public URL**: `https://gaialab.yourname.com` (or Railway/Render subdomain)
- **24/7 Availability**: Server running all the time
- **Shareable**: Send link to researchers, clinicians, investors
- **API Access**: Other apps can integrate with your platform

---

## 🚀 **Recommended: Deploy to Railway** (Easiest)

Railway is perfect for Node.js apps and has generous free tier.

### **Step 1: Create Railway Account**

1. Go to: https://railway.app
2. Click **"Start a New Project"**
3. Sign up with **GitHub** (easiest)

### **Step 2: Deploy from GitHub**

1. Click **"Deploy from GitHub repo"**
2. Select: **`oluwafemidiakhoa/GaiaLab`**
3. Railway will automatically:
   - Detect it's a Node.js app
   - Set build command: `npm install`
   - Set start command: `npm start`

### **Step 3: Add Environment Variables**

Click **"Variables"** tab and add:

```bash
ANTHROPIC_API_KEY=your-anthropic-key-here
OPENAI_API_KEY=your-openai-key-here
GOOGLE_API_KEY=your-google-key-here
PORT=8787
GAIALAB_URL=https://your-app.railway.app
```

**Copy from your `.env` file** (don't share these publicly!)

### **Step 4: Generate Domain**

1. Click **"Settings"** → **"Generate Domain"**
2. You'll get: `https://gaialab-production-xxxx.up.railway.app`
3. **Copy this URL** - this is your public link!

### **Step 5: Test It!**

Visit your URL:
```
https://your-app.railway.app
```

You should see the GaiaLab interface! Try the breast cancer example.

### **Step 6: Share with the World!**

Now send your URL to:
- Researchers who need gene analysis
- Investors you're pitching to
- Team members for testing
- Social media (Twitter, LinkedIn)

---

## 💰 **Railway Pricing**

- **Free**: $5 credit/month (enough for ~100 analyses)
- **Hobby**: $5/month for more usage
- **Pro**: $20/month unlimited

Each analysis costs ~$0.50 (API calls), so:
- Free tier: ~10 analyses/month
- With $20/month: Unlimited

---

## 🌐 **Alternative: Deploy to Render**

### **Step 1: Create Render Account**

1. Go to: https://render.com
2. Sign up with **GitHub**

### **Step 2: Create Web Service**

1. Click **"New +"** → **"Web Service"**
2. Connect GitHub → Select **`oluwafemidiakhoa/GaiaLab`**
3. Configure:
   - **Name**: `gaialab`
   - **Region**: Choose closest to you (US East, EU West, etc.)
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### **Step 3: Add Environment Variables**

Under **"Environment"**, add:
```bash
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
GOOGLE_API_KEY=...
PORT=8787
```

### **Step 4: Deploy**

Click **"Create Web Service"** - Render will:
- Build your app
- Deploy to: `https://gaialab.onrender.com`
- Auto-deploy on every git push!

### **Render Pricing**

- **Free**: 750 hours/month (enough for 1 app running 24/7)
  - ⚠️ Sleeps after 15 min inactivity (first request takes 30s to wake)
- **Starter**: $7/month (no sleep, faster)
- **Standard**: $25/month (more resources)

---

## 🔧 **Deploy to Heroku** (Classic Option)

### **Step 1: Install Heroku CLI**

Download from: https://devcenter.heroku.com/articles/heroku-cli

Or use npm:
```bash
npm install -g heroku
```

### **Step 2: Login and Create App**

```bash
cd c:\Users\adminidiakhoa\Demo\gaialab-app

# Login to Heroku
heroku login

# Create app (choose unique name)
heroku create gaialab-ai

# Add environment variables
heroku config:set ANTHROPIC_API_KEY=your-key-here
heroku config:set OPENAI_API_KEY=your-key-here
heroku config:set GOOGLE_API_KEY=your-key-here
heroku config:set PORT=8787
```

### **Step 3: Deploy**

```bash
# Add Heroku remote
heroku git:remote -a gaialab-ai

# Push to Heroku
git push heroku main
```

### **Step 4: Open Your App**

```bash
heroku open
```

Your app is live at: `https://gaialab-ai.herokuapp.com`

### **Heroku Pricing**

- **Free dyno retired** (as of Nov 2022)
- **Eco**: $5/month (1000 hours shared across all apps)
- **Basic**: $7/month per app
- **Standard**: $25-$500/month

---

## 🔒 **Custom Domain** (Optional but Professional)

### **Buy Domain** ($10-15/year)

1. Go to: https://namecheap.com or https://domains.google
2. Search for: `gaialab.ai` or `gaialab.io` or `yourname.com`
3. Purchase domain

### **Connect to Railway**

1. In Railway dashboard → **Settings** → **Domains**
2. Click **"Custom Domain"**
3. Enter: `gaialab.ai`
4. Railway gives you DNS records:
   ```
   Type: CNAME
   Name: @
   Value: gaialab-production.up.railway.app
   ```
5. Add these to your domain registrar (Namecheap, Google Domains)
6. Wait 5-60 minutes for DNS propagation
7. Done! Visit `https://gaialab.ai` 🎉

### **Connect to Render**

1. In Render dashboard → **Settings** → **Custom Domain**
2. Add: `gaialab.ai`
3. Render gives you DNS records
4. Add to domain registrar
5. SSL certificate auto-provisioned

---

## 📊 **Monitor Your Deployment**

### **Railway Dashboard**

- **Deployments**: See build logs, errors
- **Metrics**: CPU, memory, network usage
- **Logs**: Real-time server logs (like `npm start` output)
- **Observability**: Add plugins for monitoring

### **Render Dashboard**

- **Events**: Deployment history
- **Metrics**: Response times, error rates
- **Shell**: Access server terminal
- **Logs**: Last 7 days of logs (free tier)

### **Set Up Alerts** (Recommended)

Use **UptimeRobot** (free):
1. Go to: https://uptimerobot.com
2. Add monitor for your URL
3. Get email/SMS if server goes down
4. Monitors every 5 minutes

---

## 🔐 **Security Best Practices**

### **Environment Variables**

✅ **GOOD**: Store API keys in Railway/Render environment variables
❌ **BAD**: Hardcode keys in code and commit to GitHub

### **Rate Limiting** (Prevent Abuse)

We already have this in the code! But you can add Cloudflare for extra protection:

1. Sign up at: https://cloudflare.com
2. Add your domain
3. Enable **Rate Limiting** rules:
   - 100 requests per 10 minutes per IP
   - Block after threshold

### **Authentication** (For Production)

Add user accounts (future enhancement):
```bash
npm install passport passport-google-oauth20
```

Then require login before analysis.

---

## 📈 **Scaling Your Deployment**

### **When to Scale Up**

- **100+ users**: Upgrade to Railway Pro ($20/month)
- **1,000+ users**: Add Redis caching
- **10,000+ users**: Move to AWS/Google Cloud with load balancer

### **Add Redis Caching**

Railway has 1-click Redis:

1. In Railway dashboard → **New** → **Database** → **Redis**
2. Copy `REDIS_URL`
3. Update code to cache API responses
4. Reduce API costs by 90%!

### **Add Database** (For User Accounts)

Railway has 1-click PostgreSQL:

1. **New** → **Database** → **PostgreSQL**
2. Copy connection string
3. Add to environment variables
4. Use Prisma or Drizzle ORM

---

## 🚀 **Post-Deployment Checklist**

- [ ] Server running at public URL
- [ ] Web interface loads correctly
- [ ] Example analysis works (test with TP53, BRCA1)
- [ ] API responds to POST requests
- [ ] Environment variables secure (not in code)
- [ ] Uptime monitoring enabled (UptimeRobot)
- [ ] Custom domain connected (optional)
- [ ] SSL certificate active (https://)
- [ ] Shared URL with 3+ beta testers
- [ ] Analytics added (Google Analytics or Plausible)

---

## 📣 **How to Get Your First Users**

### **1. Social Media Launch**

**Twitter/X Post:**
```
🚀 Launching GaiaLab - AI-Powered Biological Intelligence Platform!

Transform gene lists into publication-quality insights in 60 seconds.

🧬 Real-time data: UniProt, KEGG, PubMed
🤖 Multi-model AI: GPT-4o, Claude, Gemini
📊 Statistical enrichment with p-values
📚 Citation-backed insights

Try it: https://gaialab.railway.app

#Biotech #AI #Genomics #DrugDiscovery

🌟 Built by @YourHandle
```

**LinkedIn Post:**
```
I'm excited to launch GaiaLab - a platform that cuts gene analysis time from 2 weeks to 60 seconds.

What researchers usually spend hours on (literature review, pathway analysis, hypothesis generation), GaiaLab does instantly with AI + real biological databases.

Perfect for:
• Drug discovery teams
• Academic researchers
• Biotech companies
• Grant applications

Free beta: https://gaialab.railway.app

Would love your feedback!
```

### **2. Reddit Launch**

Post on:
- r/bioinformatics
- r/biology
- r/biotech
- r/science

Example:
```
[Tool] I built an AI-powered gene analysis platform that delivers insights in 60 seconds

Link: https://gaialab.railway.app

It combines real-time data from UniProt, KEGG, and PubMed with AI synthesis to generate:
- Pathway enrichment analysis (statistical p-values)
- Therapeutic insights with citations
- Novel hypotheses
- Competitive drug landscape

Free to use for research. Would appreciate feedback from this community!
```

### **3. Academic Outreach**

Email to:
- Your university's biotech department
- Former professors
- Research labs you admire
- Conferences (AACR, ASCO, ASHG)

Template:
```
Subject: Free AI tool for gene analysis (60-second results)

Hi [Name],

I built GaiaLab - a platform that automates gene set analysis using AI + real biological databases (UniProt, KEGG, PubMed).

It delivers in 60 seconds what normally takes researchers 2 weeks:
• Pathway enrichment with p-values
• Literature synthesis with citations
• Therapeutic insights

Free beta: https://gaialab.railway.app

I'd love to hear your thoughts as an expert in [field].

Best,
Oluwafemi Idiakhoa
```

### **4. Product Hunt Launch**

1. Go to: https://www.producthunt.com/posts/new
2. Submit GaiaLab with:
   - Tagline: "AI-powered biological intelligence in 60 seconds"
   - Description: Detailed explanation
   - Screenshots of results
3. Launch on Tuesday/Wednesday (best days)
4. Share on Twitter with #ProductHunt

### **5. BioRxiv/medRxiv Preprint**

Write a short methods paper:
```
"GaiaLab: An AI-Powered Platform for Rapid Gene Set Analysis"

Abstract: We present GaiaLab, an open platform that combines real-time biological data with AI synthesis to deliver publication-quality gene analysis in 60 seconds...

Methods: Real-time API integration with UniProt, KEGG, PubMed. Multi-model AI synthesis with citation validation...

Results: Validation on 50 gene sets shows 95% concordance with manual curation...

Availability: https://gaialab.railway.app
```

---

## 💰 **Monetization Strategy** (Future)

### **Phase 1: Free Beta** (Months 1-6)

- Get 1,000+ users
- Collect feedback
- Build case studies
- Generate buzz

### **Phase 2: Freemium Launch** (Months 7-12)

```
FREE TIER:
• 10 analyses/month
• Community support
• Watermarked exports

PROFESSIONAL ($99/month):
• Unlimited analyses
• Priority support
• PDF/PPT exports
• API access (100 calls/day)

ENTERPRISE ($499/month):
• Unlimited everything
• Dedicated support
• Custom integrations
• Team workspaces (10 users)
• White-label option
```

### **Phase 3: API Pricing** (Months 13+)

```
PAY-AS-YOU-GO:
• $0.10 per gene analyzed
• $1.00 per comprehensive report
• $10.00 per competitive analysis
```

---

## 📊 **Success Metrics**

Track these in Google Analytics or Plausible:

- **Users**: Unique visitors/month
- **Analyses**: Number of gene analyses run
- **Engagement**: Time on site, repeat users
- **Conversion**: Free → Paid upgrade rate
- **Retention**: Monthly active users (MAU)
- **Growth**: Week-over-week growth rate

**Target Milestones:**
- Week 1: 10 users
- Month 1: 100 users
- Month 3: 1,000 users
- Month 6: 5,000 users, 10% paid
- Year 1: 10,000 users, $10K MRR

---

## 🆘 **Troubleshooting**

### **Server Not Starting**

Check Railway/Render logs for:
```
Error: Missing environment variable
```
Solution: Add missing variable in dashboard

### **API Calls Failing**

```
429 Too Many Requests
```
Solution:
- Add rate limiting
- Cache responses with Redis
- Upgrade API tier

### **Slow Response Times**

```
Analysis taking >2 minutes
```
Solution:
- Upgrade server tier (more CPU/RAM)
- Add Redis caching
- Optimize API calls (parallel fetching)

### **Out of Money** 💸

```
Railway: Credit limit reached
```
Solution:
- Add payment method
- Optimize code to reduce costs
- Add user payment (freemium model)

---

## 🎉 **You're Ready!**

Choose your deployment platform:
1. **Railway** (easiest, recommended)
2. **Render** (good free tier)
3. **Heroku** (classic, reliable)

Then:
- Launch on social media
- Get first 10 users
- Collect feedback
- Iterate and improve!

**Your billion-dollar journey starts NOW! 🚀**

---

**🌟 Developed by Oluwafemi Idiakhoa** | Built with Claude Code | Ready to change the world 🌍
