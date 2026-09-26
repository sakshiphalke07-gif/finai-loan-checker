# FinAI — AI-Powered Loan Intelligence

Netlify-ready full-stack BFSI web application using:
- HTML/CSS/vanilla JavaScript frontend
- Node.js + Express API
- Anthropic Claude AI
- Google Sheets persistence
- Netlify Functions deployment

## Local development

1. Install Node.js 18+.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in the environment variables.
4. Run `npm start`.
5. Open `http://localhost:3000`.

The Express server serves the frontend locally and exposes the `/api/*` routes.

## Netlify deployment

1. Push this folder to GitHub.
2. In Netlify choose **Add new project → Import an existing project → GitHub**.
3. Select the repository.
4. Build command: leave empty.
5. Publish directory: `.`
6. Functions directory: `netlify/functions` (also defined in `netlify.toml`).
7. Add these Netlify environment variables:
   - `ANTHROPIC_API_KEY`
   - `GOOGLE_SHEET_ID`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
8. Deploy.

Do not upload `.env` or private credentials to GitHub.

## Architecture

Browser → `/api/*` → Netlify Function → Express routes → Claude / Google Sheets

The API key and Google service-account credentials remain server-side.
