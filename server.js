/**
 * ============================================================================
 *  FinAI — AI-Powered Loan Intelligence
 *  Single-file full-stack BFSI application (Express + vanilla JS frontend)
 * ============================================================================
 *  Contains:
 *   - Express server & API routes
 *   - EMI / Eligibility / Credit Score / Financial Health calculation engines
 *   - Claude (Anthropic) AI integration
 *   - Google Sheets persistence layer
 *   - Full embedded frontend (HTML/CSS/JS) — dark glassmorphism fintech UI
 * ============================================================================
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Anthropic = require('@anthropic-ai/sdk');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// ----------------------------------------------------------------------------
// Middleware
// ----------------------------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Basic rate limiting — protects the Claude/Sheets endpoints from abuse.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,                  // 60 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in a few minutes.' }
});
app.use('/api/', apiLimiter);

// ----------------------------------------------------------------------------
// Anthropic Claude client (server-side only — never exposed to the browser)
// ----------------------------------------------------------------------------
let anthropic = null;
if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
} else {
  console.warn('[FinAI] ANTHROPIC_API_KEY is not set. AI features will use fallback responses.');
}

// ----------------------------------------------------------------------------
// Google Sheets client setup (service account JWT)
// ----------------------------------------------------------------------------
function getGoogleSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!email || !rawKey || !sheetId) {
    return null; // Not configured — caller should handle gracefully.
  }

  // .env files store the private key with literal "\n" sequences; convert them
  // back into real newlines before use.
  const privateKey = rawKey.replace(/\\n/g, '\n');

  const jwtClient = new google.auth.JWT(
    email,
    null,
    privateKey,
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  return { sheets: google.sheets({ version: 'v4', auth: jwtClient }), sheetId };
}

/**
 * saveToGoogleSheets(record)
 * Appends one row representing a user's financial analysis to the configured
 * Google Sheet. Fails soft: calculations and AI results must keep working
 * even if Sheets is unreachable or misconfigured.
 */
async function saveToGoogleSheets(record) {
  try {
    const client = getGoogleSheetsClient();
    if (!client) {
      return { success: false, reason: 'not_configured' };
    }
    const { sheets, sheetId } = client;

    const row = [
      record.timestamp,
      record.fullName,
      record.age,
      record.employmentType,
      record.monthlyIncome,
      record.monthlyExpenses,
      record.existingEmi,
      record.creditScore,
      record.desiredLoanAmount,
      record.loanTenure,
      record.interestRate,
      record.estimatedEmi,
      record.debtToIncomeRatio,
      record.eligibilityStatus,
      record.riskLevel,
      record.aiSummary
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    });

    return { success: true };
  } catch (err) {
    console.error('[FinAI] Google Sheets write failed:', err.message);
    return { success: false, reason: 'api_error' };
  }
}

// ----------------------------------------------------------------------------
// VALIDATION
// ----------------------------------------------------------------------------
function validateProfile(body) {
  const errors = {};
  const n = (v) => (v === undefined || v === null || v === '' ? NaN : Number(v));

  const age = n(body.age);
  const income = n(body.monthlyIncome);
  const expenses = n(body.monthlyExpenses);
  const existingEmi = n(body.existingEmi);
  const loanAmount = n(body.desiredLoanAmount);
  const tenure = n(body.loanTenure);
  const rate = n(body.interestRate);
  const creditScore = n(body.creditScore);

  if (!body.fullName || String(body.fullName).trim().length < 2) {
    errors.fullName = 'Enter a valid full name.';
  }
  if (isNaN(age) || age < 18 || age > 70) {
    errors.age = 'Age must be between 18 and 70.';
  }
  if (isNaN(income) || income <= 0) {
    errors.monthlyIncome = 'Monthly income must be a positive number.';
  }
  if (isNaN(expenses) || expenses < 0) {
    errors.monthlyExpenses = 'Monthly expenses cannot be negative.';
  }
  if (!isNaN(income) && !isNaN(expenses) && expenses > income * 3) {
    errors.monthlyExpenses = 'Expenses seem unusually high relative to income. Please double-check.';
  }
  if (isNaN(existingEmi) || existingEmi < 0) {
    errors.existingEmi = 'Existing EMI cannot be negative.';
  }
  if (isNaN(loanAmount) || loanAmount <= 0) {
    errors.desiredLoanAmount = 'Desired loan amount must be a positive number.';
  }
  if (isNaN(tenure) || tenure <= 0 || tenure > 40) {
    errors.loanTenure = 'Loan tenure must be between 1 and 40 years.';
  }
  if (isNaN(rate) || rate <= 0 || rate > 40) {
    errors.interestRate = 'Interest rate must be a realistic positive value (up to 40%).';
  }
  if (isNaN(creditScore) || creditScore < 300 || creditScore > 900) {
    errors.creditScore = 'Credit score must be between 300 and 900.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

// ----------------------------------------------------------------------------
// EMI CALCULATION ENGINE
// Standard reducing-balance formula: EMI = P × r × (1+r)^n / ((1+r)^n − 1)
// ----------------------------------------------------------------------------
function calculateEMI(principal, annualRatePercent, tenureYears) {
  const P = Number(principal);
  const annualRate = Number(annualRatePercent);
  const n = Math.round(Number(tenureYears) * 12); // months

  if (P <= 0 || n <= 0) {
    return { emi: 0, totalInterest: 0, totalPayment: 0, months: 0 };
  }

  if (annualRate === 0) {
    const emi = P / n;
    return { emi, totalInterest: 0, totalPayment: P, months: n };
  }

  const r = annualRate / 12 / 100; // monthly rate
  const factor = Math.pow(1 + r, n);
  const emi = (P * r * factor) / (factor - 1);
  const totalPayment = emi * n;
  const totalInterest = totalPayment - P;

  return {
    emi: round2(emi),
    totalInterest: round2(totalInterest),
    totalPayment: round2(totalPayment),
    months: n
  };
}

function round2(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

// ----------------------------------------------------------------------------
// LOAN ELIGIBILITY ENGINE
// ----------------------------------------------------------------------------
const EMPLOYMENT_STABILITY_FACTOR = {
  Salaried: 1.0,
  'Business Owner': 0.85,
  'Self-employed': 0.8,
  Freelancer: 0.7,
  Student: 0.4,
  Other: 0.75
};

function scoreCreditFactor(creditScore) {
  if (creditScore >= 750) return 1.0;
  if (creditScore >= 650) return 0.8;
  if (creditScore >= 550) return 0.55;
  return 0.3;
}

function calculateEligibility(profile) {
  const income = Number(profile.monthlyIncome);
  const expenses = Number(profile.monthlyExpenses);
  const existingEmi = Number(profile.existingEmi);
  const creditScore = Number(profile.creditScore);
  const employmentType = profile.employmentType || 'Other';
  const experience = Number(profile.employmentExperience) || 0;
  const loanAmount = Number(profile.desiredLoanAmount);
  const tenure = Number(profile.loanTenure);
  const rate = Number(profile.interestRate);

  // 1. Disposable income
  const disposableIncome = Math.max(income - expenses - existingEmi, 0);

  // 2. Requested loan's EMI at given terms
  const { emi: requestedEmi } = calculateEMI(loanAmount, rate, tenure);

  // 3. Max recommended EMI capacity — commonly ~50% of gross income minus
  //    existing obligations, capped by disposable income.
  const maxEmiCapacity = Math.max(income * 0.5 - existingEmi, 0);
  const emiCapacityUsed = maxEmiCapacity > 0 ? requestedEmi / maxEmiCapacity : 2;

  // 4. Debt-to-income ratio (including the new EMI)
  const debtToIncomeRatio = income > 0
    ? round2(((existingEmi + requestedEmi) / income) * 100)
    : 100;

  // 5. Employment stability factor
  const stabilityFactor = EMPLOYMENT_STABILITY_FACTOR[employmentType] ?? 0.7;
  const experienceBoost = Math.min(experience / 10, 1) * 0.15; // up to +0.15

  // 6. Credit factor
  const creditFactor = scoreCreditFactor(creditScore);

  // 7. Composite eligibility score (0-100)
  let score = 0;
  score += creditFactor * 35;                                   // credit weight
  score += (1 - Math.min(debtToIncomeRatio / 100, 1)) * 30;      // DTI weight
  score += Math.min(stabilityFactor + experienceBoost, 1) * 20;  // stability weight
  score += (1 - Math.min(emiCapacityUsed, 1)) * 15;              // capacity weight

  score = Math.max(0, Math.min(100, round2(score)));

  let eligibilityStatus;
  if (score >= 70) eligibilityStatus = 'Eligible';
  else if (score >= 45) eligibilityStatus = 'Conditionally Eligible';
  else eligibilityStatus = 'Needs Improvement';

  let riskLevel;
  if (debtToIncomeRatio < 35 && creditScore >= 700) riskLevel = 'Low';
  else if (debtToIncomeRatio < 55 && creditScore >= 600) riskLevel = 'Moderate';
  else riskLevel = 'High';

  const riskReasons = [];
  if (debtToIncomeRatio >= 55) riskReasons.push('Your estimated debt-to-income ratio is relatively high.');
  else if (debtToIncomeRatio >= 35) riskReasons.push('Your debt-to-income ratio is moderate and worth monitoring.');
  else riskReasons.push('Your debt-to-income ratio is within a healthy range.');

  if (creditScore < 650) riskReasons.push('Your credit score is below the range lenders typically view as strong.');
  else if (creditScore < 750) riskReasons.push('Your credit score is good, with room to reach the excellent range.');
  else riskReasons.push('Your credit score is in a strong, lender-favorable range.');

  if (emiCapacityUsed > 1) riskReasons.push('The requested EMI exceeds your estimated comfortable repayment capacity.');
  if (experience < 1 && employmentType !== 'Student') riskReasons.push('Limited employment history may be viewed as a stability factor by lenders.');

  return {
    eligibilityScore: score,
    eligibilityStatus,
    riskLevel,
    riskReasons,
    disposableIncome: round2(disposableIncome),
    requestedEmi: round2(requestedEmi),
    maxEmiCapacity: round2(maxEmiCapacity),
    debtToIncomeRatio,
    creditFactor: round2(creditFactor * 100),
    stabilityFactor: round2(Math.min(stabilityFactor + experienceBoost, 1) * 100)
  };
}

// ----------------------------------------------------------------------------
// CREDIT SCORE ANALYZER
// ----------------------------------------------------------------------------
function analyzeCreditScore(creditScore) {
  const score = Number(creditScore);
  let category, interpretation;

  if (score >= 750) {
    category = 'Excellent';
    interpretation = 'This range is generally viewed favorably by lenders and may support better interest rates.';
  } else if (score >= 650) {
    category = 'Good';
    interpretation = 'This is a solid score. Small improvements could unlock even better loan terms.';
  } else if (score >= 550) {
    category = 'Fair';
    interpretation = 'This score may lead to higher interest rates or added scrutiny from some lenders.';
  } else {
    category = 'Poor';
    interpretation = 'This score may make loan approval more difficult without improvement first.';
  }

  const factors = [
    'Payment history — consistent, on-time payments',
    'Credit utilization — how much of your available credit is in use',
    'Length of credit history',
    'Number and mix of credit accounts',
    'Recent hard inquiries or new credit applications'
  ];

  const improvementTips = [
    'Pay all bills and existing EMIs on time, every time.',
    'Keep credit utilization below roughly 30% of your limit.',
    'Avoid opening several new credit lines in a short period.',
    'Maintain older accounts open to preserve credit history length.',
    'Review your credit report periodically for errors.'
  ];

  return { score, category, interpretation, factors, improvementTips };
}

// ----------------------------------------------------------------------------
// FINANCIAL HEALTH SCORE (app-generated educational indicator)
// ----------------------------------------------------------------------------
function calculateFinancialHealth(profile) {
  const income = Number(profile.monthlyIncome);
  const expenses = Number(profile.monthlyExpenses);
  const existingEmi = Number(profile.existingEmi);
  const savings = Number(profile.monthlySavings) || 0;
  const creditScore = Number(profile.creditScore);

  const savingsRate = income > 0 ? savings / income : 0;
  const expenseRatio = income > 0 ? (expenses + existingEmi) / income : 1;
  const creditFactor = scoreCreditFactor(creditScore);

  let health = 0;
  health += Math.min(savingsRate * 100, 25);            // up to 25 pts for saving
  health += (1 - Math.min(expenseRatio, 1)) * 35;        // up to 35 pts for low expense ratio
  health += creditFactor * 30;                           // up to 30 pts for credit
  health += profile.missedPayments === 'No' ? 10 : 0;    // 10 pts for clean payment history

  return Math.max(0, Math.min(100, Math.round(health)));
}

// ----------------------------------------------------------------------------
// CLAUDE (ANTHROPIC) INTEGRATION
// ----------------------------------------------------------------------------
const CLAUDE_SYSTEM_PROMPT = `You are an AI financial education and loan-planning assistant embedded inside "FinAI", an educational BFSI web platform.

Rules you must always follow:
- Analyze only the information explicitly supplied to you. Never invent financial data.
- Clearly distinguish deterministic calculations (already computed and provided to you) from your own generated insights.
- Never guarantee loan approval or claim to represent, or act on behalf of, any bank or lender.
- Explain financial concepts in simple, plain language accessible to a non-expert.
- Provide personalized, responsible, and actionable suggestions.
- Mention uncertainty where appropriate — you are producing an educational estimate, not an official decision.
- Never request or reference unnecessary sensitive information (no account numbers, national ID numbers, passwords, etc).
- Respond ONLY with valid JSON matching the exact schema given in the user message. No preamble, no markdown code fences, no extra commentary.`;

function buildClaudePrompt(profile, calculations) {
  return `Analyze the following user-supplied financial profile and pre-computed calculations, then produce a structured JSON response.

FINANCIAL PROFILE (user-supplied):
- Age: ${profile.age}
- Employment type: ${profile.employmentType}
- Employment experience: ${profile.employmentExperience || 0} years
- Monthly income: ${profile.monthlyIncome}
- Monthly expenses: ${profile.monthlyExpenses}
- Existing EMIs: ${profile.existingEmi}
- Existing loan amount: ${profile.existingLoanAmount || 0}
- Monthly savings: ${profile.monthlySavings || 0}
- Dependents: ${profile.dependents || 0}
- Credit score: ${profile.creditScore}
- Credit history length: ${profile.creditHistoryLength || 'N/A'} years
- Number of existing loans: ${profile.numberOfLoans || 0}
- Number of credit accounts: ${profile.numberOfCreditAccounts || 0}
- Missed payments: ${profile.missedPayments || 'Unknown'}
- Desired loan amount: ${profile.desiredLoanAmount}
- Desired tenure: ${profile.loanTenure} years
- Interest rate: ${profile.interestRate}%

PRE-COMPUTED CALCULATIONS (already accurate — do not recompute or contradict):
- Estimated EMI: ${calculations.requestedEmi}
- Debt-to-income ratio: ${calculations.debtToIncomeRatio}%
- Disposable monthly income: ${calculations.disposableIncome}
- Eligibility score: ${calculations.eligibilityScore}/100
- Eligibility status: ${calculations.eligibilityStatus}
- Risk level: ${calculations.riskLevel}

Return ONLY this JSON schema, with no other text:
{
  "eligibilitySummary": "2-3 sentence plain-language summary of the eligibility outlook",
  "eligibilityStatus": "Eligible | Conditionally Eligible | Needs Improvement",
  "riskLevel": "Low | Moderate | High",
  "riskExplanation": "2-3 sentences explaining the key drivers of this risk level",
  "emiInsight": "1-2 sentences of practical insight about the EMI and tenure choice",
  "financialTips": ["tip 1", "tip 2", "tip 3", "tip 4"],
  "improvementActions": ["action 1", "action 2", "action 3"]
}`;
}

function fallbackAiResult(calculations) {
  return {
    eligibilitySummary: `Based on the calculations, your estimated eligibility score is ${calculations.eligibilityScore}/100, placing you in the "${calculations.eligibilityStatus}" category. This is a rules-based estimate generated without live AI analysis.`,
    eligibilityStatus: calculations.eligibilityStatus,
    riskLevel: calculations.riskLevel,
    riskExplanation: calculations.riskReasons.join(' '),
    emiInsight: `Your estimated EMI is ${calculations.requestedEmi} based on the loan amount, rate, and tenure entered. Adjusting tenure or amount will change this figure.`,
    financialTips: [
      'Keep monthly obligations below roughly half of your income where possible.',
      'Pay all EMIs and bills on time to protect your credit score.',
      'Build an emergency fund covering a few months of expenses.',
      'Compare loan offers from multiple lenders before committing.'
    ],
    improvementActions: [
      'Reduce existing debt where feasible before applying.',
      'Avoid new credit inquiries close to your loan application.',
      'Consider a longer tenure if the EMI feels tight, understanding it increases total interest.'
    ],
    aiGenerated: false
  };
}

async function callClaude(profile, calculations) {
  if (!anthropic) {
    return fallbackAiResult(calculations);
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: CLAUDE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildClaudePrompt(profile, calculations) }]
    });

    const rawText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    parsed.aiGenerated = true;
    return parsed;
  } catch (err) {
    console.error('[FinAI] Claude API error or malformed JSON:', err.message);
    return fallbackAiResult(calculations);
  }
}

// ----------------------------------------------------------------------------
// API ROUTES
// ----------------------------------------------------------------------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    claudeConfigured: !!anthropic,
    sheetsConfigured: !!getGoogleSheetsClient(),
    timestamp: new Date().toISOString()
  });
});

// EMI calculator (pure calculation, real-time, no AI needed)
app.post('/api/calculate-emi', (req, res) => {
  const { loanAmount, interestRate, tenure } = req.body;
  const amount = Number(loanAmount);
  const rate = Number(interestRate);
  const years = Number(tenure);

  if (isNaN(amount) || amount <= 0 || isNaN(rate) || rate <= 0 || isNaN(years) || years <= 0) {
    return res.status(400).json({ error: 'Please provide valid loanAmount, interestRate and tenure.' });
  }

  const result = calculateEMI(amount, rate, years);
  res.json({
    ...result,
    principal: amount
  });
});

// Credit score analyzer
app.post('/api/credit-analysis', (req, res) => {
  const score = Number(req.body.creditScore);
  if (isNaN(score) || score < 300 || score > 900) {
    return res.status(400).json({ error: 'Credit score must be between 300 and 900.' });
  }
  res.json(analyzeCreditScore(score));
});

// Financial tips (rules-based quick tips, no AI call required — fast path)
app.post('/api/financial-tips', (req, res) => {
  const { isValid, errors } = validateProfile(req.body);
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid profile data.', fields: errors });
  }
  const calculations = calculateEligibility(req.body);
  const fallback = fallbackAiResult(calculations);
  res.json({ tips: fallback.financialTips, improvementActions: fallback.improvementActions });
});

// Full AI-powered analysis — the core endpoint
app.post('/api/analyze', async (req, res) => {
  const profile = req.body;
  const { isValid, errors } = validateProfile(profile);

  if (!isValid) {
    return res.status(400).json({ error: 'Please review the highlighted fields.', fields: errors });
  }

  try {
    const calculations = calculateEligibility(profile);
    const creditAnalysis = analyzeCreditScore(profile.creditScore);
    const financialHealth = calculateFinancialHealth(profile);
    const emiBreakdown = calculateEMI(profile.desiredLoanAmount, profile.interestRate, profile.loanTenure);

    let aiResult;
    let aiAvailable = true;
    try {
      aiResult = await callClaude(profile, calculations);
      aiAvailable = aiResult.aiGenerated !== false;
    } catch (aiErr) {
      aiResult = fallbackAiResult(calculations);
      aiAvailable = false;
    }

    const record = {
      timestamp: new Date().toISOString(),
      fullName: profile.fullName,
      age: profile.age,
      employmentType: profile.employmentType,
      monthlyIncome: profile.monthlyIncome,
      monthlyExpenses: profile.monthlyExpenses,
      existingEmi: profile.existingEmi,
      creditScore: profile.creditScore,
      desiredLoanAmount: profile.desiredLoanAmount,
      loanTenure: profile.loanTenure,
      interestRate: profile.interestRate,
      estimatedEmi: emiBreakdown.emi,
      debtToIncomeRatio: calculations.debtToIncomeRatio,
      eligibilityStatus: calculations.eligibilityStatus,
      riskLevel: calculations.riskLevel,
      aiSummary: aiResult.eligibilitySummary
    };

    const sheetsResult = await saveToGoogleSheets(record);

    res.json({
      calculations,
      creditAnalysis,
      financialHealth,
      emiBreakdown,
      ai: aiResult,
      aiAvailable,
      storage: sheetsResult
    });
  } catch (err) {
    console.error('[FinAI] /api/analyze error:', err.message);
    res.status(500).json({ error: 'Something went wrong while analyzing your profile. Please try again.' });
  }
});

// Explicit save-record endpoint (used if frontend wants to persist independently)
app.post('/api/save-record', async (req, res) => {
  try {
    const result = await saveToGoogleSheets({ timestamp: new Date().toISOString(), ...req.body });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, reason: 'unexpected_error' });
  }
});

// ----------------------------------------------------------------------------
// FRONTEND (served as a single static page)
// ----------------------------------------------------------------------------
const FRONTEND_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>FinAI — AI-Powered Loan Intelligence</title>
<meta name="description" content="Know your loan eligibility, analyze credit risk, calculate EMIs and get AI-powered financial guidance." />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<style>
  :root{
    --bg: #060910;
    --bg-alt: #0A0F1C;
    --panel: rgba(255,255,255,0.045);
    --panel-border: rgba(255,255,255,0.09);
    --panel-strong: rgba(255,255,255,0.07);
    --text: #E7EAF3;
    --text-dim: #9AA3B8;
    --text-faint: #6B7387;
    --indigo: #6366F1;
    --cyan: #22D3EE;
    --emerald: #34D399;
    --amber: #FBBF24;
    --rose: #FB7185;
    --grad: linear-gradient(120deg, #6366F1 0%, #22D3EE 100%);
    --radius-lg: 22px;
    --radius-md: 14px;
    --radius-sm: 9px;
    --shadow-glow: 0 0 60px rgba(99,102,241,0.18);
  }
  *{ box-sizing: border-box; }
  html{ scroll-behavior: smooth; }
  body{
    margin:0;
    background: radial-gradient(ellipse 80% 60% at 15% -10%, rgba(99,102,241,0.16), transparent 60%),
                radial-gradient(ellipse 70% 50% at 100% 0%, rgba(34,211,238,0.10), transparent 55%),
                var(--bg);
    color: var(--text);
    font-family: 'Inter', -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
    overflow-x: hidden;
  }
  h1,h2,h3,h4,.display{ font-family: 'Space Grotesk', 'Inter', sans-serif; letter-spacing: -0.02em; }
  a{ color: inherit; }
  .wrap{ max-width: 1180px; margin: 0 auto; padding: 0 28px; }
  ::selection{ background: rgba(99,102,241,0.4); }

  /* ---------- glass primitive ---------- */
  .glass{
    background: var(--panel);
    border: 1px solid var(--panel-border);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    border-radius: var(--radius-lg);
  }

  /* ---------- nav ---------- */
  header{
    position: sticky; top:0; z-index: 100;
    background: rgba(6,9,16,0.72);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  nav{ display:flex; align-items:center; justify-content:space-between; padding: 16px 28px; max-width: 1180px; margin:0 auto; }
  .logo{ display:flex; align-items:center; gap:10px; font-family:'Space Grotesk'; font-weight:700; font-size: 1.25rem; }
  .logo-mark{ width:30px; height:30px; border-radius:9px; background: var(--grad); display:flex; align-items:center; justify-content:center; box-shadow: 0 0 18px rgba(99,102,241,0.55); }
  .logo-mark svg{ width:17px; height:17px; }
  .nav-links{ display:flex; gap: 30px; list-style:none; margin:0; padding:0; }
  .nav-links a{ text-decoration:none; color: var(--text-dim); font-size: 0.93rem; font-weight:500; transition: color .2s; }
  .nav-links a:hover{ color: var(--text); }
  .nav-cta{
    background: var(--grad); color:#060910; border:none; padding: 10px 20px; border-radius: 999px;
    font-weight:600; font-size:0.9rem; cursor:pointer; font-family:'Inter';
  }
  .nav-cta:hover{ filter: brightness(1.08); }
  .hamburger{ display:none; background:none; border:none; color:var(--text); font-size:1.5rem; cursor:pointer; }
  .mobile-menu{ display:none; flex-direction:column; gap:16px; padding: 20px 28px 24px; }
  .mobile-menu a{ color: var(--text-dim); text-decoration:none; font-size:1rem; }
  .mobile-menu.open{ display:flex; }

  @media (max-width: 860px){
    .nav-links{ display:none; }
    .nav-cta{ display:none; }
    .hamburger{ display:block; }
  }

  /* ---------- hero ---------- */
  .hero{ padding: 84px 0 60px; }
  .hero-grid{ display:grid; grid-template-columns: 1.05fr 0.95fr; gap: 56px; align-items:center; }
  .eyebrow{ display:inline-flex; align-items:center; gap:8px; font-size:0.8rem; color: var(--cyan); background: rgba(34,211,238,0.09); border:1px solid rgba(34,211,238,0.25); padding:6px 14px; border-radius:999px; margin-bottom:22px; }
  .eyebrow .dot{ width:6px; height:6px; border-radius:50%; background: var(--cyan); box-shadow: 0 0 8px var(--cyan); }
  .hero h1{ font-size: clamp(2.2rem, 4.3vw, 3.4rem); line-height:1.08; margin:0 0 20px; font-weight:700; }
  .hero p.lead{ font-size: 1.08rem; color: var(--text-dim); line-height:1.65; max-width: 520px; margin: 0 0 32px; }
  .hero-ctas{ display:flex; gap:14px; flex-wrap:wrap; }
  .btn-primary{ background: var(--grad); color:#060910; border:none; padding:14px 26px; border-radius:999px; font-weight:600; font-size:0.97rem; cursor:pointer; box-shadow: var(--shadow-glow); }
  .btn-primary:hover{ filter: brightness(1.07); }
  .btn-secondary{ background: transparent; border:1px solid var(--panel-border); color: var(--text); padding:14px 26px; border-radius:999px; font-weight:600; font-size:0.97rem; cursor:pointer; }
  .btn-secondary:hover{ background: rgba(255,255,255,0.04); }

  /* hero preview panel */
  .preview{ position:relative; padding: 22px; }
  .preview-row{ display:flex; gap:14px; margin-bottom:14px; }
  .mini-card{ flex:1; padding:16px; }
  .mini-label{ font-size:0.72rem; color: var(--text-faint); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px; }
  .mini-value{ font-size:1.5rem; font-weight:700; font-family:'Space Grotesk'; }
  .mini-value.g{ color: var(--emerald); }
  .mini-value.c{ color: var(--cyan); }
  .ring{ position:relative; width:96px; height:96px; margin: 6px auto 0; }
  .ring svg{ transform: rotate(-90deg); }
  .ring-track{ fill:none; stroke: rgba(255,255,255,0.08); stroke-width:8; }
  .ring-fill{ fill:none; stroke: url(#ringGrad); stroke-width:8; stroke-linecap:round; }
  .ring-label{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-weight:700; font-family:'Space Grotesk'; font-size:1.15rem; }
  .insight-toast{ display:flex; gap:12px; align-items:flex-start; padding:16px; margin-top:14px; }
  .insight-toast .ai-dot{ min-width:30px; height:30px; border-radius:9px; background: var(--grad); display:flex; align-items:center; justify-content:center; font-size:0.85rem; }
  .insight-toast p{ margin:0; font-size:0.85rem; color: var(--text-dim); line-height:1.5; }
  .insight-toast strong{ color: var(--text); }

  @media (max-width: 900px){ .hero-grid{ grid-template-columns:1fr; } .preview{ order:-1; } }

  /* ---------- sections generic ---------- */
  section{ padding: 78px 0; }
  .section-head{ max-width: 620px; margin-bottom: 46px; }
  .section-head h2{ font-size: clamp(1.7rem, 3vw, 2.3rem); margin:0 0 14px; }
  .section-head p{ color: var(--text-dim); line-height:1.6; margin:0; }

  /* why use */
  .why-grid{ display:grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
  .why-card{ padding: 28px; }
  .why-card .icn{ width:42px; height:42px; border-radius:11px; background: rgba(99,102,241,0.14); border:1px solid rgba(99,102,241,0.3); display:flex; align-items:center; justify-content:center; margin-bottom:18px; font-size:1.2rem; }
  .why-card h3{ font-size:1.05rem; margin: 0 0 8px; }
  .why-card p{ color: var(--text-dim); font-size:0.9rem; line-height:1.6; margin:0; }

  /* tools */
  .tools-grid{ display:grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
  .tool-card{ padding:26px 22px; cursor:pointer; transition: border-color .2s, transform .2s; }
  .tool-card:hover{ border-color: rgba(99,102,241,0.4); transform: translateY(-3px); }
  .tool-card .icn{ font-size:1.5rem; margin-bottom:14px; }
  .tool-card h3{ font-size:1rem; margin:0 0 6px; }
  .tool-card p{ font-size:0.83rem; color: var(--text-dim); margin:0; line-height:1.5; }

  @media (max-width: 900px){ .why-grid{ grid-template-columns:1fr 1fr; } .tools-grid{ grid-template-columns:1fr 1fr; } }
  @media (max-width: 560px){ .why-grid{ grid-template-columns:1fr; } .tools-grid{ grid-template-columns:1fr; } }

  /* ---------- form ---------- */
  .form-panel{ padding: 38px; }
  .form-group-title{ font-size:0.78rem; text-transform:uppercase; letter-spacing:0.07em; color: var(--cyan); margin: 30px 0 16px; }
  .form-group-title:first-child{ margin-top:0; }
  .field-grid{ display:grid; grid-template-columns: repeat(3, 1fr); gap:18px; }
  .field{ display:flex; flex-direction:column; gap:7px; }
  .field label{ font-size:0.82rem; color: var(--text-dim); }
  .field input, .field select{
    background: rgba(255,255,255,0.04); border:1px solid var(--panel-border); color: var(--text);
    padding: 11px 13px; border-radius: 10px; font-size:0.92rem; font-family:'Inter'; outline:none;
    transition: border-color .15s, box-shadow .15s;
  }
  .field input:focus, .field select:focus{ border-color: var(--indigo); box-shadow: 0 0 0 3px rgba(99,102,241,0.18); }
  .field .msg{ font-size:0.76rem; min-height: 14px; }
  .field .msg.err{ color: var(--rose); }
  .field .msg.ok{ color: var(--emerald); }
  .field.invalid input, .field.invalid select{ border-color: var(--rose); }
  .field.valid input, .field.valid select{ border-color: var(--emerald); }
  @media (max-width: 860px){ .field-grid{ grid-template-columns: 1fr 1fr; } }
  @media (max-width: 560px){ .field-grid{ grid-template-columns: 1fr; } }

  .submit-row{ margin-top: 34px; display:flex; align-items:center; gap:18px; flex-wrap:wrap; }
  .submit-note{ font-size:0.8rem; color: var(--text-faint); }

  /* AI loading */
  .ai-loading{ display:none; align-items:center; gap:14px; padding: 18px 22px; margin-top: 22px; }
  .ai-loading.show{ display:flex; }
  .neuro{ position:relative; width:34px; height:34px; }
  .neuro span{ position:absolute; width:7px; height:7px; border-radius:50%; background: var(--cyan); animation: pulse 1.2s ease-in-out infinite; }
  .neuro span:nth-child(1){ top:0; left:14px; animation-delay:0s; }
  .neuro span:nth-child(2){ top:14px; left:0; animation-delay:.15s; background: var(--indigo); }
  .neuro span:nth-child(3){ top:14px; left:27px; animation-delay:.3s; background: var(--indigo); }
  .neuro span:nth-child(4){ top:27px; left:14px; animation-delay:.45s; }
  @keyframes pulse{ 0%,100%{ opacity:.35; transform:scale(0.8);} 50%{ opacity:1; transform:scale(1.15);} }
  .ai-loading p{ margin:0; font-size:0.9rem; color: var(--text-dim); }

  /* ---------- results ---------- */
  #resultsSection{ display:none; }
  #resultsSection.show{ display:block; }
  .empty-state{ padding: 60px 30px; text-align:center; }
  .empty-state .glyph{ width:56px; height:56px; margin: 0 auto 18px; border-radius:16px; background: rgba(99,102,241,0.12); border:1px solid rgba(99,102,241,0.3); display:flex; align-items:center; justify-content:center; font-size:1.5rem; }
  .empty-state p{ color: var(--text-dim); font-size:0.95rem; max-width: 340px; margin: 0 auto; }

  .dash-grid{ display:grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-bottom: 20px; }
  .stat-card{ padding: 24px; }
  .stat-card .mini-label{ margin-bottom:10px; }
  .stat-card .big{ font-size: 1.9rem; font-weight:700; font-family:'Space Grotesk'; }
  .status-pill{ display:inline-block; margin-top:8px; padding:4px 12px; border-radius:999px; font-size:0.76rem; font-weight:600; }
  .status-pill.good{ background: rgba(52,211,153,0.15); color: var(--emerald); }
  .status-pill.mid{ background: rgba(251,191,36,0.15); color: var(--amber); }
  .status-pill.bad{ background: rgba(251,113,133,0.15); color: var(--rose); }

  @media (max-width: 860px){ .dash-grid{ grid-template-columns: 1fr 1fr; } }
  @media (max-width: 560px){ .dash-grid{ grid-template-columns: 1fr; } }

  .panel-2col{ display:grid; grid-template-columns: 1.1fr 0.9fr; gap: 18px; margin-bottom: 20px; }
  @media (max-width: 900px){ .panel-2col{ grid-template-columns: 1fr; } }
  .panel{ padding: 26px; }
  .panel h3{ font-size:1.05rem; margin:0 0 16px; }

  .risk-meter{ position:relative; height:10px; border-radius:999px; background: rgba(255,255,255,0.07); overflow:hidden; margin: 14px 0 12px; }
  .risk-meter-fill{ height:100%; border-radius:999px; transition: width .6s ease; }
  .risk-labels{ display:flex; justify-content:space-between; font-size:0.75rem; color: var(--text-faint); }
  .risk-reasons{ margin-top:16px; list-style:none; padding:0; }
  .risk-reasons li{ font-size:0.86rem; color: var(--text-dim); padding: 8px 0; border-top: 1px solid rgba(255,255,255,0.06); line-height:1.5; }

  .credit-ring-wrap{ display:flex; flex-direction:column; align-items:center; }
  .credit-cat{ margin-top:12px; font-weight:600; font-family:'Space Grotesk'; }
  .credit-factors{ margin-top:18px; width:100%; }
  .credit-factors h4{ font-size:0.8rem; color:var(--text-faint); text-transform:uppercase; letter-spacing:0.05em; margin: 0 0 10px;}
  .credit-factors ul{ margin:0; padding-left:18px; color:var(--text-dim); font-size:0.85rem; line-height:1.7; }

  .ai-summary-box{ padding: 26px; margin-bottom:20px; border-image: none; position:relative; }
  .ai-summary-box .ai-badge{ display:inline-flex; align-items:center; gap:7px; font-size:0.75rem; color:var(--cyan); margin-bottom:14px; }
  .ai-summary-box .ai-badge .dot{ width:6px; height:6px; border-radius:50%; background: var(--cyan); }
  .ai-summary-box p{ color: var(--text-dim); line-height:1.7; font-size:0.94rem; margin:0 0 12px; }

  .tips-grid{ display:grid; grid-template-columns: repeat(2, 1fr); gap:16px; margin-bottom:20px; }
  @media (max-width: 700px){ .tips-grid{ grid-template-columns:1fr; } }
  .tip-card{ padding:20px; display:flex; gap:14px; }
  .tip-card .icn{ font-size:1.3rem; }
  .tip-card h4{ margin:0 0 6px; font-size:0.95rem; }
  .tip-card p{ margin:0; font-size:0.84rem; color: var(--text-dim); line-height:1.55; }

  .checklist{ list-style:none; padding:0; margin:0; }
  .checklist li{ display:flex; gap:10px; align-items:flex-start; padding: 9px 0; font-size:0.88rem; color: var(--text-dim); }
  .checklist li .box{ width:16px; height:16px; border-radius:5px; border:1px solid var(--panel-border); flex-shrink:0; margin-top:2px; }

  .disclaimer-box{ padding: 18px 22px; font-size: 0.82rem; color: var(--text-faint); line-height:1.6; margin-top: 8px; }

  /* ---------- EMI calculator ---------- */
  .emi-layout{ display:grid; grid-template-columns: 0.85fr 1.15fr; gap: 22px; }
  @media (max-width: 900px){ .emi-layout{ grid-template-columns:1fr; } }
  .emi-inputs{ padding: 26px; }
  .slider-field{ margin-bottom: 22px; }
  .slider-field .row-top{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px; }
  .slider-field label{ font-size:0.85rem; color: var(--text-dim); }
  .slider-field .val{ font-weight:600; font-family:'Space Grotesk'; color: var(--cyan); }
  input[type=range]{ width:100%; accent-color: #6366F1; }
  .emi-output{ padding: 26px; }
  .emi-big{ text-align:center; padding: 20px 0 26px; border-bottom: 1px solid rgba(255,255,255,0.07); margin-bottom: 20px; }
  .emi-big .amount{ font-size: 2.6rem; font-weight:700; font-family:'Space Grotesk'; background: var(--grad); -webkit-background-clip:text; background-clip:text; color:transparent; }
  .emi-breakdown-row{ display:flex; justify-content:space-between; padding: 10px 0; font-size:0.9rem; color: var(--text-dim); border-bottom: 1px solid rgba(255,255,255,0.05); }
  .emi-breakdown-row span:last-child{ color: var(--text); font-weight:600; }
  .chart-wrap{ max-width: 220px; margin: 18px auto 0; }

  /* what-if */
  .whatif-compare{ display:grid; grid-template-columns: 1fr 1fr; gap:14px; margin-top:18px; }
  .whatif-col{ padding:18px; }
  .whatif-col h4{ margin:0 0 12px; font-size:0.85rem; color: var(--text-faint); text-transform:uppercase; letter-spacing:0.04em; }

  /* how it works */
  .steps-grid{ display:grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
  @media (max-width: 900px){ .steps-grid{ grid-template-columns: 1fr 1fr; } }
  @media (max-width: 560px){ .steps-grid{ grid-template-columns: 1fr; } }
  .step-card{ padding: 24px; position:relative; }
  .step-num{ font-family:'Space Grotesk'; font-size:1.6rem; font-weight:700; background: var(--grad); -webkit-background-clip:text; background-clip:text; color:transparent; margin-bottom: 14px; }
  .step-card h4{ margin:0 0 8px; font-size:0.98rem; }
  .step-card p{ margin:0; font-size:0.84rem; color: var(--text-dim); line-height:1.55; }

  /* privacy / disclaimer */
  .info-grid{ display:grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  @media (max-width: 800px){ .info-grid{ grid-template-columns:1fr; } }
  .info-card{ padding: 28px; }
  .info-card h3{ margin:0 0 12px; font-size:1.05rem; }
  .info-card p, .info-card li{ color: var(--text-dim); font-size:0.88rem; line-height:1.65; }
  .info-card ul{ padding-left: 18px; margin: 10px 0 0; }

  footer{ border-top:1px solid rgba(255,255,255,0.06); padding: 40px 0; margin-top: 40px; }
  .footer-row{ display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; }
  .footer-row p{ color: var(--text-faint); font-size:0.82rem; margin:0; }

  .fade-up{ opacity:0; transform: translateY(16px); transition: opacity .5s ease, transform .5s ease; }
  .fade-up.in{ opacity:1; transform: translateY(0); }

  .toast{ position:fixed; bottom:26px; right:26px; padding:14px 20px; border-radius:12px; font-size:0.87rem; z-index:999; max-width:320px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); display:none; }
  .toast.show{ display:block; }
  .toast.warn{ background: rgba(251,191,36,0.14); border:1px solid rgba(251,191,36,0.35); color:#FDE68A; }
  .toast.err{ background: rgba(251,113,133,0.14); border:1px solid rgba(251,113,133,0.35); color:#FECACA; }
</style>
</head>
<body>

<svg width="0" height="0"><defs>
  <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#6366F1"/>
    <stop offset="100%" stop-color="#22D3EE"/>
  </linearGradient>
</defs></svg>

<header>
  <nav>
    <div class="logo">
      <div class="logo-mark">
        <svg viewBox="0 0 24 24" fill="none"><path d="M4 14L9 9L13 13L20 6" stroke="#060910" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      FinAI
    </div>
    <ul class="nav-links">
      <li><a href="#top">Home</a></li>
      <li><a href="#eligibility">Loan Eligibility</a></li>
      <li><a href="#credit">Credit Analyzer</a></li>
      <li><a href="#emi">EMI Calculator</a></li>
      <li><a href="#tips">AI Financial Tips</a></li>
    </ul>
    <button class="nav-cta" onclick="scrollToForm()">Start Analysis</button>
    <button class="hamburger" id="hamburgerBtn" aria-label="Open menu">☰</button>
  </nav>
  <div class="mobile-menu" id="mobileMenu">
    <a href="#top">Home</a>
    <a href="#eligibility">Loan Eligibility</a>
    <a href="#credit">Credit Analyzer</a>
    <a href="#emi">EMI Calculator</a>
    <a href="#tips">AI Financial Tips</a>
    <button class="nav-cta" style="margin-top:8px;" onclick="scrollToForm()">Start Analysis</button>
  </div>
</header>

<main id="top">

  <!-- HERO -->
  <section class="hero">
    <div class="wrap hero-grid">
      <div>
        <div class="eyebrow"><span class="dot"></span> AI-powered financial decision assistant</div>
        <h1>Know your loan potential before you apply.</h1>
        <p class="lead">Analyze eligibility, estimate your credit risk, calculate EMIs and receive personalized financial guidance — all powered by AI.</p>
        <div class="hero-ctas">
          <button class="btn-primary" onclick="scrollToForm()">Check My Eligibility</button>
          <button class="btn-secondary" onclick="document.getElementById('tools').scrollIntoView({behavior:'smooth'})">Explore Tools</button>
        </div>
      </div>
      <div class="preview glass">
        <div class="preview-row">
          <div class="mini-card glass">
            <div class="mini-label">Eligibility</div>
            <div class="ring">
              <svg width="96" height="96" viewBox="0 0 96 96">
                <circle class="ring-track" cx="48" cy="48" r="40"></circle>
                <circle class="ring-fill" cx="48" cy="48" r="40" stroke-dasharray="251" stroke-dashoffset="63"></circle>
              </svg>
              <div class="ring-label">78%</div>
            </div>
          </div>
          <div class="mini-card glass">
            <div class="mini-label">Credit Score</div>
            <div class="mini-value c">742</div>
            <div class="mini-label" style="margin-top:14px;">EMI Preview</div>
            <div class="mini-value g">₹18,420</div>
          </div>
        </div>
        <div class="insight-toast glass">
          <div class="ai-dot">✦</div>
          <p><strong>AI Insight —</strong> Your debt-to-income ratio looks healthy. Reducing tenure by 1 year could lower total interest by an estimated 8–10%.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- WHY USE -->
  <section>
    <div class="wrap">
      <div class="section-head fade-up">
        <h2>Why use FinAI</h2>
        <p>A single place to understand where you stand financially before walking into a lender's office.</p>
      </div>
      <div class="why-grid">
        <div class="why-card glass fade-up"><div class="icn">📊</div><h3>Transparent calculations</h3><p>Every number — EMI, DTI, eligibility score — is computed with a visible, explainable formula, not a black box.</p></div>
        <div class="why-card glass fade-up"><div class="icn">🧠</div><h3>AI-generated guidance</h3><p>Claude analyzes your profile to surface plain-language insights and personalized next steps.</p></div>
        <div class="why-card glass fade-up"><div class="icn">🔒</div><h3>Privacy-conscious</h3><p>We only ask for what's needed to run the calculations — no account numbers, no ID numbers, ever.</p></div>
      </div>
    </div>
  </section>

  <!-- TOOLS -->
  <section id="tools">
    <div class="wrap">
      <div class="section-head fade-up">
        <h2>Four tools, one profile</h2>
        <p>Fill in your details once, then explore every tool without re-entering data.</p>
      </div>
      <div class="tools-grid">
        <div class="tool-card glass fade-up" onclick="scrollToForm()"><div class="icn">🏦</div><h3>Loan Eligibility Checker</h3><p>Estimate your standing across income, credit and debt factors.</p></div>
        <div class="tool-card glass fade-up" onclick="scrollToForm()"><div class="icn">📈</div><h3>Credit Score Analyzer</h3><p>See what your score category means and how to improve it.</p></div>
        <div class="tool-card glass fade-up" onclick="document.getElementById('emi').scrollIntoView({behavior:'smooth'})"><div class="icn">🧮</div><h3>EMI Calculator</h3><p>Real-time EMI, interest and repayment breakdown as you type.</p></div>
        <div class="tool-card glass fade-up" onclick="scrollToForm()"><div class="icn">💡</div><h3>AI Financial Tips</h3><p>Personalized, actionable suggestions based on your profile.</p></div>
      </div>
    </div>
  </section>

  <!-- FORM -->
  <section id="eligibility">
    <div class="wrap">
      <div class="section-head fade-up">
        <h2>Your financial profile</h2>
        <p>This information stays on this analysis only — used to calculate your results and generate AI insights.</p>
      </div>

      <form class="form-panel glass fade-up" id="profileForm" novalidate>
        <div class="form-group-title">Personal Details</div>
        <div class="field-grid">
          <div class="field" id="f-fullName"><label for="fullName">Full Name</label><input id="fullName" name="fullName" type="text" placeholder="Jane Doe" /><div class="msg"></div></div>
          <div class="field" id="f-age"><label for="age">Age</label><input id="age" name="age" type="number" placeholder="18–70" /><div class="msg"></div></div>
          <div class="field" id="f-city"><label for="city">City</label><input id="city" name="city" type="text" placeholder="City" /><div class="msg"></div></div>
          <div class="field" id="f-employmentType"><label for="employmentType">Employment Type</label>
            <select id="employmentType" name="employmentType">
              <option value="Salaried">Salaried</option>
              <option value="Self-employed">Self-employed</option>
              <option value="Business Owner">Business Owner</option>
              <option value="Freelancer">Freelancer</option>
              <option value="Student">Student</option>
              <option value="Other">Other</option>
            </select><div class="msg"></div>
          </div>
        </div>

        <div class="form-group-title">Financial Details</div>
        <div class="field-grid">
          <div class="field" id="f-monthlyIncome"><label for="monthlyIncome">Monthly Income</label><input id="monthlyIncome" name="monthlyIncome" type="number" placeholder="e.g. 60000" /><div class="msg"></div></div>
          <div class="field" id="f-monthlyExpenses"><label for="monthlyExpenses">Monthly Expenses</label><input id="monthlyExpenses" name="monthlyExpenses" type="number" placeholder="e.g. 25000" /><div class="msg"></div></div>
          <div class="field" id="f-existingEmi"><label for="existingEmi">Existing EMIs</label><input id="existingEmi" name="existingEmi" type="number" placeholder="e.g. 5000" /><div class="msg"></div></div>
          <div class="field" id="f-existingLoanAmount"><label for="existingLoanAmount">Existing Loan Amount</label><input id="existingLoanAmount" name="existingLoanAmount" type="number" placeholder="e.g. 200000" /><div class="msg"></div></div>
          <div class="field" id="f-desiredLoanAmount"><label for="desiredLoanAmount">Desired Loan Amount</label><input id="desiredLoanAmount" name="desiredLoanAmount" type="number" placeholder="e.g. 1000000" /><div class="msg"></div></div>
          <div class="field" id="f-loanTenure"><label for="loanTenure">Desired Loan Tenure (years)</label><input id="loanTenure" name="loanTenure" type="number" placeholder="e.g. 5" /><div class="msg"></div></div>
          <div class="field" id="f-interestRate"><label for="interestRate">Interest Rate (%)</label><input id="interestRate" name="interestRate" type="number" step="0.1" placeholder="e.g. 9.5" /><div class="msg"></div></div>
        </div>

        <div class="form-group-title">Credit Information</div>
        <div class="field-grid">
          <div class="field" id="f-creditScore"><label for="creditScore">Credit Score</label><input id="creditScore" name="creditScore" type="number" placeholder="300–900" /><div class="msg"></div></div>
          <div class="field" id="f-creditHistoryLength"><label for="creditHistoryLength">Credit History Length (years)</label><input id="creditHistoryLength" name="creditHistoryLength" type="number" placeholder="e.g. 4" /><div class="msg"></div></div>
          <div class="field" id="f-numberOfLoans"><label for="numberOfLoans">Number of Existing Loans</label><input id="numberOfLoans" name="numberOfLoans" type="number" placeholder="e.g. 1" /><div class="msg"></div></div>
          <div class="field" id="f-numberOfCreditAccounts"><label for="numberOfCreditAccounts">Number of Credit Accounts</label><input id="numberOfCreditAccounts" name="numberOfCreditAccounts" type="number" placeholder="e.g. 2" /><div class="msg"></div></div>
          <div class="field" id="f-missedPayments"><label for="missedPayments">Any Missed Payments</label>
            <select id="missedPayments" name="missedPayments"><option value="No">No</option><option value="Yes">Yes</option></select><div class="msg"></div>
          </div>
        </div>

        <div class="form-group-title">Additional Information</div>
        <div class="field-grid">
          <div class="field" id="f-employmentExperience"><label for="employmentExperience">Employment Experience (years)</label><input id="employmentExperience" name="employmentExperience" type="number" placeholder="e.g. 3" /><div class="msg"></div></div>
          <div class="field" id="f-monthlySavings"><label for="monthlySavings">Monthly Savings</label><input id="monthlySavings" name="monthlySavings" type="number" placeholder="e.g. 8000" /><div class="msg"></div></div>
          <div class="field" id="f-dependents"><label for="dependents">Dependents</label><input id="dependents" name="dependents" type="number" placeholder="e.g. 2" /><div class="msg"></div></div>
        </div>

        <div class="submit-row">
          <button type="submit" class="btn-primary" id="analyzeBtn">Analyze My Profile</button>
          <span class="submit-note">Takes about 10 seconds. Nothing is stored except this analysis record.</span>
        </div>

        <div class="ai-loading glass" id="aiLoading">
          <div class="neuro"><span></span><span></span><span></span><span></span></div>
          <p>AI is analyzing your financial profile…</p>
        </div>
      </form>
    </div>
  </section>

  <!-- RESULTS -->
  <section id="results">
    <div class="wrap">
      <div class="section-head fade-up">
        <h2>Your financial intelligence report</h2>
        <p>Estimated eligibility, risk and AI-generated insights based on the profile you submitted.</p>
      </div>

      <div class="empty-state glass fade-up" id="emptyState">
        <div class="glyph">✦</div>
        <p>Your financial intelligence report will appear here once you analyze your profile above.</p>
      </div>

      <div id="resultsSection">
        <div class="dash-grid">
          <div class="stat-card glass"><div class="mini-label">Estimated Eligibility</div><div class="big" id="r-eligibilityScore">—</div><div class="status-pill" id="r-eligibilityStatus"></div></div>
          <div class="stat-card glass"><div class="mini-label">Risk Level</div><div class="big" id="r-riskLevel">—</div><div class="mini-label" style="margin-top:10px;">Debt-to-Income</div><div class="mini-value c" id="r-dti">—</div></div>
          <div class="stat-card glass"><div class="mini-label">Estimated EMI</div><div class="big" id="r-emi">—</div><div class="mini-label" style="margin-top:10px;">Monthly Disposable Income</div><div class="mini-value g" id="r-disposable">—</div></div>
        </div>

        <div class="ai-summary-box glass" id="aiSummaryBox">
          <div class="ai-badge"><span class="dot"></span> AI-Generated Analysis</div>
          <p id="r-eligibilitySummary"></p>
          <p id="r-emiInsight"></p>
        </div>

        <div class="panel-2col">
          <div class="panel glass">
            <h3>Risk Assessment</h3>
            <div class="risk-meter"><div class="risk-meter-fill" id="riskMeterFill"></div></div>
            <div class="risk-labels"><span>Low</span><span>Moderate</span><span>High</span></div>
            <ul class="risk-reasons" id="riskReasons"></ul>
          </div>
          <div class="panel glass credit-ring-wrap">
            <h3 style="align-self:flex-start;">Credit Score Analysis</h3>
            <div class="ring" style="width:130px;height:130px;">
              <svg width="130" height="130" viewBox="0 0 130 130">
                <circle class="ring-track" cx="65" cy="65" r="55"></circle>
                <circle class="ring-fill" cx="65" cy="65" r="55" id="creditRingFill" stroke-dasharray="345" stroke-dashoffset="345"></circle>
              </svg>
              <div class="ring-label" id="creditRingLabel">—</div>
            </div>
            <div class="credit-cat" id="creditCategory">—</div>
            <div class="credit-factors">
              <h4>Improvement Tips</h4>
              <ul id="creditTipsList"></ul>
            </div>
          </div>
        </div>

        <div class="panel-2col">
          <div class="panel glass">
            <h3>Financial Health Score</h3>
            <div style="display:flex;align-items:baseline;gap:10px;">
              <div class="big" id="r-healthScore">—</div><span class="mini-label">/ 100</span>
            </div>
            <div class="risk-meter" style="margin-top:16px;"><div class="risk-meter-fill" id="healthMeterFill" style="background:var(--grad);"></div></div>
            <p style="font-size:0.82rem;color:var(--text-faint);margin-top:10px;">An application-generated educational indicator — not an official financial rating.</p>
          </div>
          <div class="panel glass">
            <h3>Improvement Checklist</h3>
            <ul class="checklist" id="improvementChecklist"></ul>
          </div>
        </div>

        <div id="tips">
          <h3 style="margin:34px 0 16px;font-size:1.15rem;">AI Financial Tips</h3>
          <div class="tips-grid" id="tipsGrid"></div>
        </div>

        <div class="disclaimer-box glass">
          This is an AI-assisted estimate for educational and planning purposes. Actual lending decisions depend on the lender's policies and verification. FinAI is not a bank or lender and does not guarantee loan approval.
        </div>
      </div>
    </div>
  </section>

  <!-- EMI CALCULATOR -->
  <section id="emi">
    <div class="wrap">
      <div class="section-head fade-up">
        <h2>EMI calculator</h2>
        <p>Adjust the sliders — your monthly EMI updates instantly.</p>
      </div>
      <div class="emi-layout">
        <div class="emi-inputs glass fade-up">
          <div class="slider-field">
            <div class="row-top"><label>Loan Amount</label><span class="val" id="emiAmountVal">₹10,00,000</span></div>
            <input type="range" id="emiAmount" min="50000" max="10000000" step="10000" value="1000000">
          </div>
          <div class="slider-field">
            <div class="row-top"><label>Interest Rate</label><span class="val" id="emiRateVal">9.5%</span></div>
            <input type="range" id="emiRate" min="1" max="24" step="0.1" value="9.5">
          </div>
          <div class="slider-field">
            <div class="row-top"><label>Tenure</label><span class="val" id="emiTenureVal">5 yrs</span></div>
            <input type="range" id="emiTenure" min="1" max="30" step="1" value="5">
          </div>
        </div>
        <div class="emi-output glass fade-up">
          <div class="emi-big"><div class="mini-label">Monthly EMI</div><div class="amount" id="emiAmountOut">₹0</div></div>
          <div class="emi-breakdown-row"><span>Principal</span><span id="emiPrincipalOut">—</span></div>
          <div class="emi-breakdown-row"><span>Total Interest</span><span id="emiInterestOut">—</span></div>
          <div class="emi-breakdown-row"><span>Total Repayment</span><span id="emiTotalOut">—</span></div>
          <div class="chart-wrap"><canvas id="emiChart" width="200" height="200"></canvas></div>
        </div>
      </div>

      <div class="panel glass fade-up" style="margin-top:22px;">
        <h3>What-if scenario: 3 years vs 5 years</h3>
        <p style="color:var(--text-dim);font-size:0.88rem;">Using your current loan amount and rate above — extending tenure may reduce monthly EMI but can increase total interest paid.</p>
        <div class="whatif-compare">
          <div class="whatif-col glass"><h4>3-year tenure</h4><div class="emi-breakdown-row"><span>EMI</span><span id="wi3-emi">—</span></div><div class="emi-breakdown-row"><span>Total Interest</span><span id="wi3-interest">—</span></div></div>
          <div class="whatif-col glass"><h4>5-year tenure</h4><div class="emi-breakdown-row"><span>EMI</span><span id="wi5-emi">—</span></div><div class="emi-breakdown-row"><span>Total Interest</span><span id="wi5-interest">—</span></div></div>
        </div>
      </div>
    </div>
  </section>

  <!-- CREDIT SECTION ANCHOR (tool also lives inside results) -->
  <section id="credit" style="padding-top:0;"></section>

  <!-- HOW IT WORKS -->
  <section>
    <div class="wrap">
      <div class="section-head fade-up">
        <h2>How it works</h2>
        <p>From raw numbers to a personalized financial report in four steps.</p>
      </div>
      <div class="steps-grid">
        <div class="step-card glass fade-up"><div class="step-num">01</div><h4>Enter financial details</h4><p>Share your income, expenses, credit and loan information once.</p></div>
        <div class="step-card glass fade-up"><div class="step-num">02</div><h4>AI + financial analysis</h4><p>Our engine computes EMI, DTI and eligibility while Claude analyzes context.</p></div>
        <div class="step-card glass fade-up"><div class="step-num">03</div><h4>Eligibility & risk assessment</h4><p>See a transparent breakdown of your eligibility score and risk level.</p></div>
        <div class="step-card glass fade-up"><div class="step-num">04</div><h4>Personalized insights</h4><p>Get plain-language tips and an improvement checklist tailored to you.</p></div>
      </div>
    </div>
  </section>

  <!-- PRIVACY & DISCLAIMER -->
  <section>
    <div class="wrap info-grid">
      <div class="info-card glass fade-up">
        <h3>Privacy & security</h3>
        <p>We only collect the information needed to run these calculations.</p>
        <ul>
          <li>No passwords, account or card numbers are ever requested.</li>
          <li>Claude API keys and Google credentials stay server-side, never sent to your browser.</li>
          <li>Records are stored only if Google Sheets is configured by the site operator.</li>
        </ul>
      </div>
      <div class="info-card glass fade-up">
        <h3>Disclaimer</h3>
        <p>FinAI is an educational financial-planning tool — not a bank, lender or credit bureau.</p>
        <ul>
          <li>AI-generated estimates are for educational and financial planning purposes only.</li>
          <li>Actual eligibility, interest rates and approval depend on the lender's own policies, verification and applicable regulations.</li>
          <li>Credit scores entered here are self-reported and not an official bureau assessment.</li>
        </ul>
      </div>
    </div>
  </section>

</main>

<footer>
  <div class="wrap footer-row">
    <div class="logo"><div class="logo-mark"><svg viewBox="0 0 24 24" fill="none"><path d="M4 14L9 9L13 13L20 6" stroke="#060910" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>FinAI</div>
    <p>Smarter financial decisions, powered by AI. Educational estimates only — not a lender.</p>
  </div>
</footer>

<div class="toast" id="toast"></div>

<script>
(function(){

  // ---------- helpers ----------
  function fmtMoney(v){
    var n = Number(v);
    if(isNaN(n)) return "—";
    return "₹" + Math.round(n).toLocaleString('en-IN');
  }
  function showToast(msg, type){
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show ' + (type||'warn');
    setTimeout(function(){ t.className = 'toast'; }, 5000);
  }
  function scrollToForm(){
    document.getElementById('eligibility').scrollIntoView({behavior:'smooth'});
  }
  window.scrollToForm = scrollToForm;

  // ---------- mobile menu ----------
  var hamburgerBtn = document.getElementById('hamburgerBtn');
  var mobileMenu = document.getElementById('mobileMenu');
  hamburgerBtn.addEventListener('click', function(){
    mobileMenu.classList.toggle('open');
  });
  mobileMenu.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click', function(){ mobileMenu.classList.remove('open'); });
  });

  // ---------- scroll reveal ----------
  var revealEls = document.querySelectorAll('.fade-up');
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){ entry.target.classList.add('in'); io.unobserve(entry.target); }
    });
  }, { threshold: 0.12 });
  revealEls.forEach(function(el){ io.observe(el); });

  // ==========================================================
  // FORM VALIDATION
  // ==========================================================
  var form = document.getElementById('profileForm');
  var fieldRules = {
    fullName: function(v){ return v.trim().length >= 2 ? null : 'Enter a valid full name.'; },
    age: function(v){ var n=Number(v); return (n>=18 && n<=70) ? null : 'Age must be between 18 and 70.'; },
    city: function(v){ return v.trim().length >= 2 ? null : 'Enter a valid city.'; },
    monthlyIncome: function(v){ var n=Number(v); return n>0 ? null : 'Must be a positive number.'; },
    monthlyExpenses: function(v, all){ var n=Number(v); if(n<0) return 'Cannot be negative.'; var inc=Number(all.monthlyIncome); if(inc>0 && n>inc*3) return 'Unusually high relative to income.'; return null; },
    existingEmi: function(v){ var n=Number(v); return n>=0 ? null : 'Cannot be negative.'; },
    existingLoanAmount: function(v){ var n=Number(v); return n>=0 ? null : 'Cannot be negative.'; },
    desiredLoanAmount: function(v){ var n=Number(v); return n>0 ? null : 'Must be a positive number.'; },
    loanTenure: function(v){ var n=Number(v); return (n>0 && n<=40) ? null : 'Must be between 1 and 40 years.'; },
    interestRate: function(v){ var n=Number(v); return (n>0 && n<=40) ? null : 'Must be a realistic positive value.'; },
    creditScore: function(v){ var n=Number(v); return (n>=300 && n<=900) ? null : 'Must be between 300 and 900.'; },
    creditHistoryLength: function(v){ var n=Number(v); return n>=0 ? null : 'Cannot be negative.'; },
    numberOfLoans: function(v){ var n=Number(v); return n>=0 ? null : 'Cannot be negative.'; },
    numberOfCreditAccounts: function(v){ var n=Number(v); return n>=0 ? null : 'Cannot be negative.'; },
    employmentExperience: function(v){ var n=Number(v); return n>=0 ? null : 'Cannot be negative.'; },
    monthlySavings: function(v){ var n=Number(v); return n>=0 ? null : 'Cannot be negative.'; },
    dependents: function(v){ var n=Number(v); return n>=0 ? null : 'Cannot be negative.'; }
  };

  function getFormValues(){
    var fd = new FormData(form);
    var obj = {};
    fd.forEach(function(v,k){ obj[k]=v; });
    return obj;
  }

  function validateField(name){
    var wrap = document.getElementById('f-' + name);
    if(!wrap) return true;
    var input = form.elements[name];
    var msgEl = wrap.querySelector('.msg');
    var rule = fieldRules[name];
    if(!rule){ return true; }
    var error = rule(input.value, getFormValues());
    wrap.classList.remove('valid','invalid');
    if(input.value.trim() === ''){
      msgEl.textContent = '';
      msgEl.className = 'msg';
      return false;
    }
    if(error){
      wrap.classList.add('invalid');
      msgEl.textContent = '✕ ' + error;
      msgEl.className = 'msg err';
      return false;
    } else {
      wrap.classList.add('valid');
      msgEl.textContent = '✓ Looks good';
      msgEl.className = 'msg ok';
      return true;
    }
  }

  Object.keys(fieldRules).forEach(function(name){
    var input = form.elements[name];
    if(input){ input.addEventListener('input', function(){ validateField(name); }); input.addEventListener('blur', function(){ validateField(name); }); }
  });

  function validateAll(){
    var allValid = true;
    Object.keys(fieldRules).forEach(function(name){
      var ok = validateField(name);
      if(!ok) allValid = false;
    });
    return allValid;
  }

  // ==========================================================
  // SUBMIT -> /api/analyze
  // ==========================================================
  form.addEventListener('submit', function(e){
    e.preventDefault();
    if(!validateAll()){
      showToast('Please review the highlighted fields.', 'err');
      return;
    }
    var payload = getFormValues();
    var btn = document.getElementById('analyzeBtn');
    var loading = document.getElementById('aiLoading');
    btn.disabled = true;
    loading.classList.add('show');

    fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(res){ return res.json().then(function(data){ return { ok: res.ok, data: data }; }); })
    .then(function(result){
      loading.classList.remove('show');
      btn.disabled = false;
      if(!result.ok){
        showToast(result.data.error || 'Please review the highlighted fields.', 'err');
        return;
      }
      renderResults(result.data);
      if(result.data.storage && !result.data.storage.success){
        showToast('Your analysis is complete, but cloud record storage is temporarily unavailable.', 'warn');
      }
      if(!result.data.aiAvailable){
        showToast('AI analysis is temporarily unavailable. Your EMI and eligibility calculations are still available.', 'warn');
      }
      document.getElementById('results').scrollIntoView({behavior:'smooth'});
    })
    .catch(function(){
      loading.classList.remove('show');
      btn.disabled = false;
      showToast('Something went wrong. Please try again.', 'err');
    });
  });

  function riskColor(level){
    if(level === 'Low') return 'var(--emerald)';
    if(level === 'Moderate') return 'var(--amber)';
    return 'var(--rose)';
  }
  function statusClass(status){
    if(status === 'Eligible') return 'good';
    if(status === 'Conditionally Eligible') return 'mid';
    return 'bad';
  }

  function renderResults(data){
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('resultsSection').classList.add('show');

    var c = data.calculations, credit = data.creditAnalysis, health = data.financialHealth, ai = data.ai;

    document.getElementById('r-eligibilityScore').textContent = c.eligibilityScore + '%';
    var statusPill = document.getElementById('r-eligibilityStatus');
    statusPill.textContent = c.eligibilityStatus;
    statusPill.className = 'status-pill ' + statusClass(c.eligibilityStatus);

    document.getElementById('r-riskLevel').textContent = c.riskLevel;
    document.getElementById('r-riskLevel').style.color = riskColor(c.riskLevel);
    document.getElementById('r-dti').textContent = c.debtToIncomeRatio + '%';

    document.getElementById('r-emi').textContent = fmtMoney(data.emiBreakdown.emi);
    document.getElementById('r-disposable').textContent = fmtMoney(c.disposableIncome);

    document.getElementById('r-eligibilitySummary').textContent = ai.eligibilitySummary;
    document.getElementById('r-emiInsight').textContent = ai.emiInsight;

    var riskPct = c.riskLevel === 'Low' ? 22 : (c.riskLevel === 'Moderate' ? 55 : 88);
    var fill = document.getElementById('riskMeterFill');
    fill.style.width = riskPct + '%';
    fill.style.background = riskColor(c.riskLevel);

    var reasonsList = document.getElementById('riskReasons');
    reasonsList.innerHTML = '';
    (c.riskReasons || []).forEach(function(r){
      var li = document.createElement('li'); li.textContent = r; reasonsList.appendChild(li);
    });

    // credit ring
    var circumference = 2 * Math.PI * 55;
    var pct = Math.max(0, Math.min(1, (credit.score - 300) / 600));
    var ringFill = document.getElementById('creditRingFill');
    ringFill.setAttribute('stroke-dasharray', circumference);
    ringFill.setAttribute('stroke-dashoffset', circumference * (1 - pct));
    document.getElementById('creditRingLabel').textContent = credit.score;
    document.getElementById('creditCategory').textContent = credit.category;

    var tipsList = document.getElementById('creditTipsList');
    tipsList.innerHTML = '';
    (credit.improvementTips || []).slice(0,4).forEach(function(t){
      var li = document.createElement('li'); li.textContent = t; tipsList.appendChild(li);
    });

    document.getElementById('r-healthScore').textContent = health;
    document.getElementById('healthMeterFill').style.width = health + '%';

    var checklist = document.getElementById('improvementChecklist');
    checklist.innerHTML = '';
    (ai.improvementActions || []).forEach(function(a){
      var li = document.createElement('li');
      li.innerHTML = '<span class="box"></span><span>' + a + '</span>';
      checklist.appendChild(li);
    });

    var tipIcons = ['💡','📉','🛡️','💰','📅','📈','⚖️'];
    var tipTitles = ['Financial Tip', 'Debt Management', 'Savings Insight', 'Credit Behavior', 'Loan Planning', 'Expense Insight'];
    var tipsGrid = document.getElementById('tipsGrid');
    tipsGrid.innerHTML = '';
    (ai.financialTips || []).forEach(function(tip, i){
      var card = document.createElement('div');
      card.className = 'tip-card glass';
      card.innerHTML = '<div class="icn">' + tipIcons[i % tipIcons.length] + '</div><div><h4>' + tipTitles[i % tipTitles.length] + '</h4><p>' + tip + '</p></div>';
      tipsGrid.appendChild(card);
    });
  }

  // ==========================================================
  // EMI CALCULATOR (real-time, client-side using same formula)
  // ==========================================================
  function calcEmiLocal(P, annualRate, years){
    var n = Math.round(years * 12);
    if(P<=0 || n<=0) return { emi:0, totalInterest:0, totalPayment:0 };
    if(annualRate === 0){ var emiZero = P/n; return { emi: emiZero, totalInterest:0, totalPayment:P }; }
    var r = annualRate/12/100;
    var factor = Math.pow(1+r, n);
    var emi = (P*r*factor)/(factor-1);
    var totalPayment = emi*n;
    return { emi: emi, totalInterest: totalPayment - P, totalPayment: totalPayment };
  }

  var emiAmount = document.getElementById('emiAmount');
  var emiRate = document.getElementById('emiRate');
  var emiTenure = document.getElementById('emiTenure');
  var chartInstance = null;

  function updateEmi(){
    var P = Number(emiAmount.value);
    var rate = Number(emiRate.value);
    var years = Number(emiTenure.value);

    document.getElementById('emiAmountVal').textContent = fmtMoney(P);
    document.getElementById('emiRateVal').textContent = rate + '%';
    document.getElementById('emiTenureVal').textContent = years + (years===1?' yr':' yrs');

    var result = calcEmiLocal(P, rate, years);
    document.getElementById('emiAmountOut').textContent = fmtMoney(result.emi);
    document.getElementById('emiPrincipalOut').textContent = fmtMoney(P);
    document.getElementById('emiInterestOut').textContent = fmtMoney(result.totalInterest);
    document.getElementById('emiTotalOut').textContent = fmtMoney(result.totalPayment);

    // what-if 3 vs 5 years
    var r3 = calcEmiLocal(P, rate, 3);
    var r5 = calcEmiLocal(P, rate, 5);
    document.getElementById('wi3-emi').textContent = fmtMoney(r3.emi);
    document.getElementById('wi3-interest').textContent = fmtMoney(r3.totalInterest);
    document.getElementById('wi5-emi').textContent = fmtMoney(r5.emi);
    document.getElementById('wi5-interest').textContent = fmtMoney(r5.totalInterest);

    var ctx = document.getElementById('emiChart');
    if(window.Chart){
      if(chartInstance){ chartInstance.destroy(); }
      chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Principal', 'Interest'],
          datasets: [{ data: [P, Math.max(result.totalInterest,0)], backgroundColor: ['#6366F1', '#22D3EE'], borderWidth: 0 }]
        },
        options: {
          cutout: '72%',
          plugins: { legend: { labels: { color: '#9AA3B8', font: { family: 'Inter', size: 11 } } } }
        }
      });
    }
  }
  [emiAmount, emiRate, emiTenure].forEach(function(el){ el.addEventListener('input', updateEmi); });
  updateEmi();

})();
</script>
</body>
</html>
`;



app.get('/', (req, res) => {
  res.type('html').send(FRONTEND_HTML);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[FinAI] Server running on http://localhost:${PORT}`);
    console.log(`[FinAI] Claude configured: ${!!anthropic}`);
    console.log(`[FinAI] Google Sheets configured: ${!!getGoogleSheetsClient()}`);
  });
}

module.exports = { app, PORT, calculateEMI, calculateEligibility, analyzeCreditScore, calculateFinancialHealth, validateProfile };
