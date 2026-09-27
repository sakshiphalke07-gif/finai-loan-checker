# FinAI — AI-Powered Loan Intelligence

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
