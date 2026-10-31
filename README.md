# FinAI — AI-POWERED LOAN INTELLIGENCE

**Know your loan potential before you apply.**

FinAI is an AI-powered financial decision-support platform designed to help users understand their financial position before applying for a loan. It combines loan eligibility estimation, credit score analysis, EMI calculation, repayment comparison, and AI-generated financial guidance in one platform.

**Live Website:** https://financexai.netlify.app/

---

## 1. PROJECT OVERVIEW

FinAI is designed to simplify financial planning by helping users understand their loan eligibility, repayment capacity, credit profile, and overall financial health.

Users can enter their personal, financial, loan, and credit-related information to receive an analysis of their financial position. The platform combines mathematical financial calculations with Google Gemini AI to provide numerical insights and personalized educational suggestions.

The main purpose of FinAI is to make financial information easier to understand and help users make more informed financial decisions.

**Key Highlights:**
- AI-powered financial analysis.
- Loan eligibility estimation.
- Credit score analysis.
- EMI calculation and comparison.
- Personalized AI financial tips.
- Financial health assessment.
- Easy-to-understand financial reports.

## 2. PROBLEM STATEMENT

Many individuals apply for loans without having a clear understanding of their repayment capacity, existing financial obligations, credit profile, or the impact of different loan tenures.

Understanding financial calculations and loan-related terminology can also be difficult for individuals who do not have a financial background.

FinAI aims to address these challenges by providing a centralized platform where users can analyze their financial information, estimate loan eligibility, calculate EMIs, understand their credit profile, and receive AI-generated financial guidance.

## 3. PROJECT OBJECTIVES

1. To simplify the loan eligibility assessment process.
2. To help users understand their financial position and repayment capacity.
3. To provide accurate mathematical calculations for EMI and other financial indicators.
4. To analyze self-reported credit scores and provide useful insights.
5. To use AI for generating personalized financial suggestions.
6. To encourage responsible borrowing and better financial management.
7. To provide an easy-to-use platform for basic financial planning.

## 4. KEY FEATURES AND FUNCTIONALITIES

### 4.1 Loan Eligibility Checker

The Loan Eligibility Checker estimates a user's loan readiness based on their submitted financial information.

It considers:
- Monthly income.
- Monthly expenses.
- Existing EMIs.
- Existing loan amount.
- Desired loan amount.
- Loan tenure.
- Interest rate.
- Credit-related information.

**Outputs:**
- Estimated loan eligibility.
- Financial risk level.
- Debt-to-income ratio.
- Estimated monthly EMI.
- Monthly disposable income.
- AI-generated eligibility analysis.

### 4.2 Credit Score Analyzer

The Credit Score Analyzer helps users understand their credit profile using the credit score and other details they provide.

It considers:
- Credit score (300–900).
- Credit history length.
- Number of existing loans.
- Number of credit accounts.
- Missed payment information.

The system provides an interpretation of the submitted credit information and suggests habits that may help users maintain or improve their credit profile.

*Note: The credit score is self-reported and is not verified through an official credit bureau.*

### 4.3 EMI Calculator

The EMI Calculator allows users to calculate their estimated monthly loan instalments.

**Inputs:**
- Loan amount.
- Annual interest rate.
- Loan tenure.

**Outputs:**
- Monthly EMI.
- Principal amount.
- Total interest payable.
- Total repayment amount.

This feature helps users understand the financial commitment associated with a loan.

### 4.4 What-If Loan Comparison

FinAI allows users to explore different loan repayment scenarios.

For example, users can compare a 3-year loan tenure with a 5-year loan tenure.

This helps users understand:
- How loan tenure affects monthly EMI.
- How total interest changes with tenure.
- The difference between shorter and longer repayment periods.
- Which repayment structure may better suit their monthly budget.

### 4.5 AI Financial Tips

FinAI uses Google Gemini AI to generate personalized financial suggestions based on the information provided by the user.

The suggestions may include:
- Improving financial management habits.
- Managing existing debts.
- Increasing monthly savings.
- Maintaining healthy credit habits.
- Planning loan repayments.
- Improving overall financial readiness.

### 4.6 Financial Intelligence Report

After the user submits their financial profile, FinAI generates a consolidated financial report.

The report can include:

- Estimated loan eligibility.
- Financial risk assessment.
- Debt-to-income ratio.
- Estimated EMI.
- Monthly disposable income.
- Credit score analysis.
- AI-generated financial insights.
- Personalized improvement suggestions.
- Financial improvement checklist.
- Financial health score out of 100.

The financial health score is an educational indicator generated by the application and is not an official financial rating.

### 4.7 Single Financial Profile

Users can enter their personal and financial details in one profile and use the different financial tools without repeatedly entering the
# FinAI — AI-Inspired Financial Decision Assistant

FinAI is a responsive frontend demo for exploring loan affordability, credit-score education, EMI calculations, and general financial tips. It is built with HTML, CSS, and vanilla JavaScript, so it can be hosted using GitHub Pages without a build step.

## Features

- Responsive dark dashboard inspired by the FinAI concept.
- Loan affordability estimator using entered income, expenses, existing EMIs, tenure, and interest rate.
- EMI calculator showing monthly payment, total interest, and total repayment.
- Educational credit profile analyzer with general habit suggestions.
- Goal-based financial tips.
- Responsive navigation and section links.
- No framework or installation required.

## Run locally

1. Download or clone this repository.
2. Open `index.html` in a modern browser.

## Publish with GitHub Pages

1. Create a GitHub repository named `finai`.
2. Upload `index.html`, `style.css`, `script.js`, and `README.md` to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/ (root)`, then save.
6. Wait for GitHub Pages to publish the site.

## Project structure

```text
FinAI/
├── index.html
├── style.css
├── script.js
└── README.md
```

## Important limitations

This is a frontend educational prototype. The “AI Financial Tips” are rule-based examples, not generated by an AI model. Credit analysis uses the score and options entered by the visitor; it does not connect to a credit bureau or retrieve a real credit report. Loan estimates are illustrative and do not represent lender approval. No information is sent to a server.

For a production version, add a secure backend, validate all inputs server-side, use a reputable credit/financial data provider where appropriate, protect personal data, and connect a real AI service only through a backend so API keys are never exposed in browser code. Do not claim regulatory compliance without professional review.
