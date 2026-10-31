# FinAI --- AI-Powered Loan Intelligence

```{=html}
<p align="center">
```
`<strong>`{=html}Know your loan potential before you
apply.`</strong>`{=html}`<br>`{=html} An AI-assisted financial planning
website for understanding loan eligibility, credit profile, EMIs, and
practical ways to improve financial health.
```{=html}
</p>
```
```{=html}
<p align="center">
```
`<a href="https://financexai.netlify.app/">`{=html}Live
Website`</a>`{=html}
```{=html}
</p>
```

------------------------------------------------------------------------

## Table of Contents

-   [Overview](#-overview)
-   [Problem Statement](#-problem-statement)
-   [Objectives](#-objectives)
-   [Key Features](#-key-features)
-   [How FinAI Works](#-how-finai-works)
-   [System Architecture](#-system-architecture)
-   [Process Flow](#-process-flow)
-   [Financial Calculations](#-financial-calculations)
-   [AI Integration](#-ai-integration)
-   [Financial Profile Inputs](#-financial-profile-inputs)
-   [Technology and Services](#-technology-and-services)
-   [Privacy and Security](#-privacy-and-security)
-   [Getting Started](#-getting-started)
-   [Deployment](#-deployment)
-   [Limitations and Disclaimer](#-limitations-and-disclaimer)
-   [Future Enhancements](#-future-enhancements)

## 💡 Overview

**FinAI** is an AI-powered financial decision-support website designed
to help users understand their financial position before applying for a
loan. It brings a loan eligibility estimator, credit score analyzer, EMI
calculator, and personalized AI-generated financial tips together in one
place.

Users enter relevant personal, income, expense, loan, and credit details
once. FinAI uses financial calculations to produce numerical indicators
and uses **Google Gemini** to generate contextual explanations and
practical suggestions.

**Live application:** https://financexai.netlify.app/

> FinAI is an educational and financial-planning assistant. It is not a
> bank, lender, credit bureau, or loan approval service.

## 🎯 Problem Statement

People may consider applying for loans without clearly understanding
their repayment capacity, existing debt burden, credit profile, or the
effect of different loan tenures. Financial terms and calculations can
also be difficult to interpret.

FinAI addresses this by providing one platform where users can estimate
loan readiness, understand debt-to-income position, compare repayment
scenarios, interpret a self-reported credit score, and receive
educational suggestions.

## 🎯 Objectives

1.  Make basic loan and credit concepts easier to understand.
2.  Provide transparent, calculation-based financial indicators.
3.  Help users compare loan repayment scenarios before applying.
4.  Present financial results in clear, accessible language.
5.  Use AI to turn a financial profile into relevant educational
    guidance.
6.  Encourage responsible borrowing and better financial planning.

## ✨ Key Features

### 1. Loan Eligibility Checker

Estimates a user's loan-readiness using submitted income, expenses,
existing EMIs, requested loan amount, tenure, interest rate, and
credit-related details. The report can include estimated eligibility,
risk level, DTI, estimated EMI, disposable income, and AI-generated
explanations.

### 2. Credit Score Analyzer

Helps users understand the credit score they enter and the context
around it, including credit-history length, existing loans and credit
accounts, and missed-payment information. The score is self-reported; it
is not fetched from an official credit bureau.

### 3. EMI Calculator

Calculates estimated monthly instalment based on loan principal, annual
interest rate, and tenure. It also displays principal, total interest,
and total repayment.

### 4. What-if Loan Comparison

Compares repayment scenarios such as 3-year and 5-year tenures. A longer
tenure can reduce monthly EMI but increase total interest; a shorter
tenure can increase monthly payments while potentially reducing total
interest.

### 5. AI Financial Tips

Uses the submitted profile as context for Gemini-generated guidance.
Suggestions may relate to debt management, savings, repayment planning,
credit habits, and financial readiness.

### 6. Financial Intelligence Report

Brings together estimated eligibility, risk level, DTI, EMI, disposable
income, AI analysis, credit score interpretation, improvement tips,
checklist, and a financial health score. The health score is an
application-generated educational indicator out of 100, not an official
financial rating.

### 7. Single Financial Profile

Users enter their information once and can explore the available tools
without repeatedly entering the same profile details.

## 🔄 How FinAI Works

1.  **Enter details:** The user fills in personal, financial, loan, and
    credit information.
2.  **Analyze:** The application calculates numerical indicators such as
    EMI and DTI. Gemini is used for contextual AI analysis.
3.  **Review results:** The user views estimated eligibility, risk
    indicators, credit analysis, and repayment information.
4.  **Take informed next steps:** The user reviews educational tips and
    the improvement checklist.

### User Journey Diagram

``` mermaid
flowchart TD
    A([Open FinAI Website]) --> B[Explore Home and Tools]
    B --> C[Enter Financial Profile]
    C --> D{Profile Submitted?}
    D -- No --> C
    D -- Yes --> E[Validate and Process Inputs]
    E --> F[Financial Calculation Engine]
    E --> G[Prepare AI Context]
    F --> H[Calculate EMI, DTI and Disposable Income]
    G --> I[Gemini Generates Explanations and Tips]
    H --> J[Combine Numerical Results and AI Insights]
    I --> J
    J --> K[Financial Intelligence Report]
    K --> L[Review Eligibility and Risk]
    K --> M[Explore Credit Analysis and EMI Scenarios]
    K --> N[Read Improvement Tips]
```

## 🏗️ System Architecture

FinAI combines a user-facing web interface, a financial calculation
layer, and an AI service. The website identifies Google Gemini as the AI
service for contextual analysis. Google Sheets may be used for record
storage when configured by the site operator.

The following is the **logical architecture**. Exact implementation
details---framework, API routes, hosting functions, and storage
configuration---should be confirmed from the source code.

``` mermaid
flowchart TB
    U[User] --> UI[FinAI Web Interface]
    UI --> PF[Financial Profile Inputs]
    PF --> VAL[Input Validation and Processing]
    VAL --> CALC[Financial Calculation Engine]
    VAL --> AIREQ[AI Analysis Request]
    CALC --> METRICS[EMI, DTI and Financial Estimates]
    AIREQ --> GEM[Google Gemini API]
    GEM --> INSIGHTS[AI Explanations and Tips]
    METRICS --> REPORT[Report Generation Layer]
    INSIGHTS --> REPORT
    REPORT --> UI
    UI -. Optional, if configured .-> SHEETS[Google Sheets Storage]
```

### Main Components

  -----------------------------------------------------------------------
  Component                           Responsibility
  ----------------------------------- -----------------------------------
  Web interface                       Displays homepage, profile form,
                                      tools, and report

  Profile input layer                 Collects information needed for
                                      analysis

  Validation and processing           Prepares values for calculations
                                      and AI analysis

  Financial calculation engine        Computes numerical financial
                                      indicators

  Gemini integration                  Generates contextual explanations
                                      and suggestions

  Report presentation                 Displays results in a readable
                                      format

  Optional Google Sheets integration  Stores records only when configured
                                      by the site operator

  Netlify hosting                     Hosts the deployed website
  -----------------------------------------------------------------------

## 🔁 Process Flow

``` mermaid
sequenceDiagram
    actor User
    participant Web as FinAI Website
    participant Calc as Calculation Engine
    participant AI as Gemini
    participant Report as Report Interface

    User->>Web: Enter profile and loan details
    User->>Web: Submit for analysis
    Web->>Web: Validate and prepare inputs
    par Numerical analysis
        Web->>Calc: Send financial values
        Calc-->>Web: Return EMI, DTI and metrics
    and AI analysis
        Web->>AI: Send relevant profile context
        AI-->>Web: Return explanations and suggestions
    end
    Web->>Report: Combine available results
    Report-->>User: Display financial intelligence report
    User->>Web: Explore calculator, credit analyzer and tips
```

## 🧮 Financial Calculations

FinAI emphasizes explainable numerical calculations for common
loan-planning indicators.

### EMI (Equated Monthly Instalment)

For a reducing-balance loan:

\[ EMI = P `\times `{=tex}`\frac{r(1+r)^n}{(1+r)^n-1}`{=tex} \]

Where: - `P` = Principal loan amount. - `r` = Monthly interest rate as a
decimal (annual rate ÷ 12 ÷ 100). - `n` = Total monthly instalments
(tenure in years × 12).

For a zero-interest loan, EMI is principal divided by the number of
instalments.

### Total Repayment and Interest

\[ `\text{Total Repayment}`{=tex} = EMI `\times `{=tex}n \]

\[ `\text{Total Interest}`{=tex} = `\text{Total Repayment}`{=tex} - P \]

### Debt-to-Income Ratio (DTI)

\[ DTI =
`\frac{\text{Monthly Debt Payments}}{\text{Gross Monthly Income}}`{=tex}
`\times 100`{=tex} \]

Monthly debt payments may include existing EMIs and the proposed EMI.
Lenders may define and assess DTI differently.

### Monthly Disposable Income

\[ `\text{Disposable Income}`{=tex} = `\text{Monthly Income}`{=tex} -
`\text{Monthly Expenses}`{=tex} - `\text{Monthly EMIs}`{=tex} \]

The treatment of a proposed new EMI depends on whether the report shows
the current or post-loan position.

> Eligibility, risk, and financial-health indicators are application
> estimates, not official lender or credit-bureau scores.

## 🧠 AI Integration

FinAI uses **Google Gemini** to provide natural-language analysis based
on the financial context submitted by the user.

The AI component is intended to: - Explain financial indicators in
simpler language. - Identify areas that may deserve attention in the
submitted profile. - Suggest practical financial habits and possible
next steps. - Generate personalized educational tips.

### Calculation Layer vs. AI Layer

  -----------------------------------------------------------------------
  Financial calculation layer         AI layer
  ----------------------------------- -----------------------------------
  Computes formula-based values such  Explains results in natural
  as EMI                              language

  Calculates numerical ratios from    Generates contextual suggestions
  submitted values                    

  Produces numerical outputs          Helps users interpret outputs

  Should be deterministic for the     May produce different wording or
  same inputs and formula             suggestions
  -----------------------------------------------------------------------

AI guidance is not a substitute for professional financial advice and
may be incomplete or inaccurate.

## 🧾 Financial Profile Inputs

  -----------------------------------------------------------------------
  Category                            Information requested
  ----------------------------------- -----------------------------------
  Personal details                    Full name, age, city, employment
                                      type

  Financial details                   Monthly income, monthly expenses,
                                      existing EMIs, existing loan
                                      amount, desired loan amount,
                                      desired tenure, interest rate

  Credit information                  Self-reported credit score
                                      (300--900), credit-history length,
                                      existing loan count, credit-account
                                      count, missed-payment information

  Additional information              Employment experience, monthly
                                      savings, number of dependents
  -----------------------------------------------------------------------

Only enter information you are comfortable sharing. Do not enter
passwords, bank-account numbers, card numbers, or identity-document
numbers.

## 🧰 Technology and Services

The website's visible functionality identifies or indicates: - **Web
application:** Interface for financial tools and the analysis report. -
**Google Gemini API:** AI-generated explanations and personalized
financial guidance. - **Netlify:** Hosting for the live deployment. -
**Google Sheets (optional):** Record storage if enabled and configured
by the site operator.

The exact frontend framework, programming languages, backend
implementation, API routes, and package versions should be confirmed
from the source code before being listed as implementation facts.

## 🔐 Privacy and Security

The website describes these privacy-conscious practices: - It does not
request passwords, bank-account numbers, or card numbers. - Gemini API
keys and Google credentials are intended to remain server-side rather
than being exposed in the browser. - Records are stored only if Google
Sheets is configured by the site operator. - Profile information is used
to perform requested calculations and generate AI insights.

For production use, review secure server-side secret management, input
validation, access control, data minimization, retention rules, and user
consent. Never commit API keys, credentials, or private user data to a
public repository.

## 🚀 Getting Started

The live website is available at **https://financexai.netlify.app/**.

To run a local development copy, obtain the project's source-code
repository. Exact commands depend on the framework and package manager
used.

General setup checklist:

1.  Clone or download the source-code repository.
2.  Open the project folder in your code editor.
3.  Check the project documentation and dependency manifest (for
    example, `package.json`, if present).
4.  Install dependencies using the package manager specified by the
    project.
5.  Configure required environment variables using the names expected by
    the source code.
6.  Keep Gemini API keys and Google credentials in secure server-side
    environment variables.
7.  Start the development server using the script defined by the
    project.
8.  Test the profile form, calculations, AI analysis, and report output.

### Environment Variables

The names below are illustrative placeholders, **not confirmed variable
names**. Check the source code or deployment settings for the exact
names expected.

``` env
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_SHEETS_CREDENTIALS=your_secure_server_side_configuration
```

Never place private API keys in frontend JavaScript or commit real
credentials to GitHub.

## 🌐 Deployment

FinAI's public website is deployed on **Netlify**:
https://financexai.netlify.app/

Typical deployment workflow:

``` mermaid
flowchart LR
    A[Project Source Code] --> B[Git Repository]
    B --> C[Netlify Deployment]
    C --> D[Configure Build Settings]
    D --> E[Add Secure Environment Variables]
    E --> F[Build and Deploy]
    F --> G[Live FinAI Website]
```

The build command, publish directory, and server-side configuration must
match the actual source code and Netlify settings.

## ⚠️ Limitations and Disclaimer

-   FinAI is an educational financial-planning tool, not a bank, lender,
    credit bureau, or financial institution.
-   Eligibility and risk results are estimates based on submitted
    information and application logic.
-   A displayed eligibility estimate does not mean a loan will be
    approved.
-   Actual eligibility, interest rates, fees, and approval depend on
    lender policies, document verification, credit-bureau information,
    and applicable regulations.
-   Credit scores entered by users are self-reported and are not
    verified against an official credit bureau.
-   The financial health score is an application-generated educational
    indicator, not an official rating.
-   AI-generated information may be inaccurate, incomplete, or
    unsuitable for a particular financial situation.
-   Verify important decisions with a qualified financial professional
    or the relevant lender.

## 🔮 Future Enhancements

1.  Official credit-bureau integration, subject to authorization and
    applicable regulations.
2.  Secure user accounts and consent-based profile history.
3.  Downloadable PDF financial reports.
4.  Loan comparison across lenders using verified, up-to-date product
    data.
5.  Interactive charts for income, expenses, debt, and repayment
    schedules.
6.  More repayment scenarios and prepayment impact analysis.
7.  Regional-language support.
8.  Improved explainability showing how each estimate is derived.
9.  Stronger privacy controls, including profile deletion and
    configurable retention.
10. Automated tests for calculations, validation, and API error
    handling.

## 👥 Project Use Cases

-   Students learning personal finance and loan concepts.
-   Individuals planning a personal, education, or other loan.
-   Users who want to understand how EMI and tenure affect repayment.
-   People who want a simple explanation of their self-reported credit
    profile.
-   Anyone seeking an initial educational overview before speaking with
    a lender.

## 📌 Project Summary

FinAI brings loan-planning calculations and AI-assisted financial
explanations into one accessible web platform. By combining eligibility
estimation, credit-profile interpretation, EMI calculations, repayment
comparisons, and personalized educational tips, it helps users better
understand their financial position and prepare more informed questions
before approaching a lender.

```{=html}
<p align="center">
```
`<strong>`{=html}FinAI --- Smarter financial decisions, powered by
AI.`</strong>`{=html}`<br>`{=html} `<sub>`{=html}Educational estimates
only. Not a lender.`</sub>`{=html}
```{=html}
</p>
```
