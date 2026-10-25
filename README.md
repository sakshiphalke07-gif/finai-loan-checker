WEBSITE LINK : https://financexai.netlify.app/


DOCUMENTATION : [📄 FinAI Project Documentation](FinAI_Project_Documentation.docx)


LIVE DEMO : https://drive.google.com/file/d/1CnleF5hftGWakzqZPMPuIN8RlLjRZXXQ/view?usp=sharing

# FinancexAI — AI-Powered Loan Intelligence

# 💰 FinAancexAI — Smart Financial Decision Assistant

**FinanceAI** is a web-based financial decision assistant designed to help users understand basic financial concepts and make more informed financial decisions. It provides tools for estimating loan eligibility, analyzing credit-related information, calculating EMIs, and receiving personalized financial tips based on user inputs.

The project demonstrates how web technologies can be used to create an accessible, interactive platform for basic financial planning.


## 📖 Overview

FinAI aims to simplify everyday financial calculations and provide basic financial guidance through a user-friendly website. Instead of manually calculating loan EMIs or exploring different financial indicators, users can enter relevant information and receive quick estimates.

The current version is a **frontend prototype** that uses JavaScript-based calculations and predefined rules. It is intended for educational and demonstration purposes.

## 🎯 Objectives

- Simplify basic financial calculations.
- Help users estimate loan affordability and monthly repayments.
- Present credit-related information in an understandable format.
- Provide useful financial tips based on user inputs.
- Demonstrate the practical application of HTML, CSS, and JavaScript.
- Create a foundation for future AI-powered financial assistance.

## ✨ Key Features

### 1. Loan Eligibility Estimator
Allows users to enter relevant financial details and receive an indicative estimate of loan eligibility.

### 2. Credit Analyzer
Provides a basic analysis of credit-related inputs and displays guidance to help users understand factors that may influence creditworthiness.

### 3. EMI Calculator
Calculates the estimated monthly instalment for
Netlify-ready full-stack BFSI web application using:
- HTML/CSS/vanilla JavaScript frontend
- Node.js + Express API
- Google Gemini AI (Gemini API)
- Google Sheets persistence
- Netlify Functions deployment

## Local development

1. Install Node.js 18+.
2. Run `npm install`.
3. Set `GEMINI_API_KEY` and any Google Sheets variables in `.env`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

## Netlify deployment

1. Push this folder to GitHub.
2. Connect the repository to Netlify.
3. Build command: leave empty.
4. Publish directory: `.`
5. Functions directory: `netlify/functions`.
6. Add these Netlify environment variables:
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (optional; defaults to `gemini-3.8-flash`)
   - `GOOGLE_SHEET_ID`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
7. Deploy.

Do not upload `.env` or private credentials to GitHub.

## Architecture

Browser → `/api/*` → Netlify Function → Express routes → Gemini / Google Sheets

The Gemini API key and Google service-account credentials remain server-side.
