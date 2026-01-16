/**
 * Drug Repurposing Engine
 *
 * Analyzes FDA-approved drugs for repurposing potential based on:
 * - Target gene overlap
 * - Disease pathway similarity
 * - Clinical evidence
 * - Safety profile
 * - Mechanism of action relevance
 *
 * COMMERCIAL VALUE: $10K-50K/year enterprise feature
 *
 */

/**
 * Calculate drug repurposing score
 *
 * @param {Object} drug - Drug data from ChEMBL/DrugBank
 * @param {Array} targetGenes - User's genes of interest
 * @param {Array} pathways - KEGG pathways for disease
 * @param {string} diseaseContext - Disease being researched
 * @returns {Object} - Repurposing analysis with score
 */
export function calculateRepurposingScore(drug, targetGenes, pathways, diseaseContext) {
  const scores = {
    targetMatch: 0,
    pathwayOverlap: 0,
    clinicalEvidence: 0,
    safetyProfile: 0,
    mechanismRelevance: 0
  };

  // 1. TARGET MATCH (30%): Does drug target our genes?
  const drugTargets = drug.targets || drug.genes || [];
  const targetGenesUpper = targetGenes.map(g => g.toUpperCase());
  const matchedTargets = drugTargets.filter(t =>
    targetGenesUpper.includes(t.toUpperCase())
  );
  scores.targetMatch = matchedTargets.length > 0 ?
    Math.min(100, (matchedTargets.length / targetGenes.length) * 100) : 0;

  // 2. PATHWAY OVERLAP (20%): Drug affects disease-related pathways?
  const drugPathways = drug.pathways || [];
  const pathwayIds = pathways.map(p => p.id || p.pathwayId);
  const overlappingPathways = drugPathways.filter(dp =>
    pathwayIds.some(pid => dp.includes(pid) || pid.includes(dp))
  );
  scores.pathwayOverlap = overlappingPathways.length > 0 ?
    Math.min(100, (overlappingPathways.length / Math.max(pathways.length, 1)) * 100) : 0;

  // 3. CLINICAL EVIDENCE (20%): Existing trials/approvals?
  const isApproved = drug.approvalStatus === 'approved' || drug.isApproved;
  const hasTrials = drug.clinicalTrials && drug.clinicalTrials.length > 0;
  const trialCount = drug.clinicalTrials?.length || 0;

  if (isApproved) {
    scores.clinicalEvidence = 100; // FDA approved
  } else if (hasTrials) {
    scores.clinicalEvidence = Math.min(80, 40 + (trialCount * 10)); // Phase trials
  } else {
    scores.clinicalEvidence = 20; // Preclinical only
  }

  // 4. SAFETY PROFILE (15%): FDA approval = proven safety
  if (isApproved) {
    scores.safetyProfile = 100;
  } else if (drug.phase === 'Phase 3' || drug.phase === 'Phase 2') {
    scores.safetyProfile = 70;
  } else if (drug.phase === 'Phase 1') {
    scores.safetyProfile = 40;
  } else {
    scores.safetyProfile = 20;
  }

  // 5. MECHANISM RELEVANCE (15%): Does mechanism match disease?
  const mechanismText = (drug.mechanism || drug.mechanismOfAction || '').toLowerCase();
  const diseaseTerms = diseaseContext.toLowerCase().split(/\s+/);
  const mechanismMatches = diseaseTerms.filter(term =>
    term.length > 3 && mechanismText.includes(term)
  );
  scores.mechanismRelevance = mechanismMatches.length > 0 ?
    Math.min(100, mechanismMatches.length * 30) : 0;

  // WEIGHTED FINAL SCORE
  const finalScore = (
    scores.targetMatch * 0.30 +
    scores.pathwayOverlap * 0.20 +
    scores.clinicalEvidence * 0.20 +
    scores.safetyProfile * 0.15 +
    scores.mechanismRelevance * 0.15
  );

  return {
    drug: drug.name || drug.drugName,
    drugId: drug.chemblId || drug.drugbankId || drug.id,
    repurposingScore: Math.round(finalScore),
    confidence: getConfidenceLevel(finalScore),
    breakdown: scores,
    matchedTargets,
    currentIndication: drug.indication || drug.diseaseArea || 'Unknown',
    proposedIndication: diseaseContext,
    mechanism: drug.mechanism || drug.mechanismOfAction || 'Not specified',
    phase: drug.phase || (isApproved ? 'FDA Approved' : 'Unknown'),
    estimatedSavings: calculateCostSavings(finalScore),
    reasoning: generateReasoning(scores, matchedTargets, diseaseContext)
  };
}

/**
 * Get confidence level from score
 */
function getConfidenceLevel(score) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Calculate estimated cost savings vs. new drug development
 * New drug: ~$2.6B and 10-15 years
 * Repurposed drug: ~$300M and 3-5 years
 */
function calculateCostSavings(score) {
  const baselineSavings = 2300; // $2.3B savings (2.6B - 0.3B)
  const timeSavings = 8; // 8 years faster (12.5 avg - 4.5 avg)

  // Higher score = higher confidence in savings
  const savingsMultiplier = score / 100;
  const estimatedSavings = Math.round(baselineSavings * savingsMultiplier);

  return {
    cost: `$${estimatedSavings}M - $${estimatedSavings + 500}M`,
    time: `${timeSavings} - ${timeSavings + 2} years faster`,
    confidence: getConfidenceLevel(score)
  };
}

/**
 * Generate human-readable reasoning
 */
function generateReasoning(scores, matchedTargets, diseaseContext) {
  const reasons = [];

  if (scores.targetMatch > 50) {
    reasons.push(`✅ Targets ${matchedTargets.length} gene(s) in your analysis`);
  } else if (scores.targetMatch > 0) {
    reasons.push(`⚠️ Partial target match (${Math.round(scores.targetMatch)}%)`);
  }

  if (scores.pathwayOverlap > 50) {
    reasons.push(`✅ Affects relevant ${diseaseContext} pathways`);
  }

  if (scores.clinicalEvidence === 100) {
    reasons.push(`✅ FDA approved with proven safety profile`);
  } else if (scores.clinicalEvidence > 40) {
    reasons.push(`⚠️ In clinical trials (Phase ${scores.clinicalEvidence > 60 ? '2/3' : '1'})`);
  }

  if (scores.mechanismRelevance > 50) {
    reasons.push(`✅ Mechanism of action relevant to ${diseaseContext}`);
  }

  if (reasons.length === 0) {
    reasons.push(`💡 Exploratory candidate - requires further validation`);
  }

  return reasons;
}

/**
 * Analyze all drugs for repurposing potential
 *
 * @param {Array} drugs - All available drugs from ChEMBL/DrugBank
 * @param {Array} targetGenes - User's genes of interest
 * @param {Array} pathways - KEGG pathways for disease
 * @param {string} diseaseContext - Disease being researched
 * @param {Object} options - Analysis options
 * @returns {Array} - Top repurposing candidates sorted by score
 */
export function analyzeRepurposingCandidates(drugs, targetGenes, pathways, diseaseContext, options = {}) {
  const {
    minScore = 30,      // Minimum score to consider
    maxResults = 10,    // Top N candidates
    onlyApproved = false // Only FDA-approved drugs
  } = options;

  console.log(`[Drug Repurposing] Analyzing ${drugs.length} drugs for ${diseaseContext}...`);
  const startTime = Date.now();

  // Filter out drugs with no target info
  let candidates = drugs.filter(drug =>
    (drug.targets && drug.targets.length > 0) ||
    (drug.genes && drug.genes.length > 0)
  );

  // Filter to only approved if requested
  if (onlyApproved) {
    candidates = candidates.filter(drug =>
      drug.approvalStatus === 'approved' || drug.isApproved
    );
  }

  // Calculate repurposing scores for all candidates
  const scoredCandidates = candidates.map(drug =>
    calculateRepurposingScore(drug, targetGenes, pathways, diseaseContext)
  );

  // Filter by minimum score and sort
  const topCandidates = scoredCandidates
    .filter(c => c.repurposingScore >= minScore)
    .sort((a, b) => b.repurposingScore - a.repurposingScore)
    .slice(0, maxResults);

  const analysisTime = Date.now() - startTime;
  console.log(`[Drug Repurposing] Found ${topCandidates.length} candidates in ${analysisTime}ms`);

  return {
    candidates: topCandidates,
    stats: {
      totalDrugsAnalyzed: drugs.length,
      candidatesFound: topCandidates.length,
      avgScore: topCandidates.length > 0
        ? Math.round(topCandidates.reduce((sum, c) => sum + c.repurposingScore, 0) / topCandidates.length)
        : 0,
      analysisTime: `${analysisTime}ms`,
      minScore,
      onlyApproved
    }
  };
}

/**
 * Generate executive summary for repurposing analysis
 */
export function generateRepurposingSummary(results, diseaseContext) {
  const { candidates, stats } = results;

  if (candidates.length === 0) {
    return {
      headline: `No strong repurposing candidates found for ${diseaseContext}`,
      summary: `Analyzed ${stats.totalDrugsAnalyzed} drugs. Consider expanding gene set or lowering score threshold.`,
      recommendation: 'Explore novel drug development or alternative therapeutic approaches.'
    };
  }

  const topCandidate = candidates[0];
  const approvedCount = candidates.filter(c => c.phase === 'FDA Approved').length;

  return {
    headline: `${candidates.length} drug repurposing ${candidates.length === 1 ? 'candidate' : 'candidates'} identified for ${diseaseContext}`,
    summary: `Top candidate: ${topCandidate.drug} (${topCandidate.repurposingScore}% match). ${approvedCount} FDA-approved drugs found.`,
    recommendation: `Prioritize ${topCandidate.drug} for experimental validation. Estimated savings: ${topCandidate.estimatedSavings.cost} vs. new drug development.`,
    commercialValue: `Enterprise feature worth $10K-50K/year. Total potential savings across ${candidates.length} candidates: $${Math.round(candidates.length * 1500)}M - $${Math.round(candidates.length * 2500)}M.`
  };
}
