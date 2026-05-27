# Schulnetz 2.0 – User Guide

![Screenshot placeholder](file:///Users/kinome/.gemini/antigravity/brain/a6c9f3e1-55a8-47c0-85e4-2aab26670f71/screenshot_placeholder_1779872956408.png)

## Overview
`Schulnetz 2.0` is a modern web application that helps Swiss CFC apprentices track, simulate and analyze their grades for both **Berufsmaturität (BM)** and **Berufsschule (EFZ)**. It offers secure authentication via Supabase, rich visualisations, AI‑powered document scanning, and flexible simulations to plan your academic path.

## Features
- **Grade tracking** for BM subjects and EFZ modules, including ÜK and IPA components.
- **Real‑time simulations** of future grades and required exam scores.
- **AI document scanner** that extracts grades from report cards and SAL screenshots using Anthropic Claude.
- **Responsive UI** built with React 18, Vite and Tailwind CSS – works on desktop and mobile.
- **Secure Supabase backend** with Row‑Level Security policies.
- **Export & import** of grade data via CSV/JSON.
- **Automatic sync** indicator showing database synchronization status.

## Prerequisites
- **Node.js** ≥ 20 (download from https://nodejs.org/)
- **npm** ≥ 7 (comes with Node.js)
- A **Supabase** account (free tier is sufficient for development)
- (Optional) **Claude API key** for document scanning – set on the server side only.

## Installation
```bash
# 1️⃣ Clone the repository
git clone <repository‑url>
cd schulnetz2.0

# 2️⃣ Install dependencies (uses lockfile for reproducible builds)
npm ci

# 3️⃣ Create environment file
cp .env.example .env
# Edit .env and set:
#   VITE_SUPABASE_URL=your‑supabase‑url
#   VITE_SUPABASE_ANON_KEY=your‑public‑anon‑key
#   (Server‑only) CLAUDE_API_KEY=your‑anthropic‑key

# 4️⃣ Start the development server
npm run dev
```
Open **http://localhost:5173** in your browser.

## Configuration
- **Supabase**: Create a project, enable Auth, and copy the URL and anon key into `.env`.
- **Database schema**: Run migrations with the Supabase CLI:
  ```bash
  supabase db push
  ```
- **AI scanning**: Deploy the `api/scan.js` serverless function (Vercel, Netlify, Railway, …) and add `CLAUDE_API_KEY` as a secret.

## Running the Application
| Command | Description |
|---|---|
| `npm run dev` | Starts Vite in watch mode with hot‑module replacement |
| `npm run build` | Produces an optimized static bundle in `dist/` |
| `npm run preview` | Serves the production bundle locally for final verification |
| `npm run lint` | Runs ESLint; must pass before any PR |

## Core Workflows
### Adding Grades
1. Log in with your Supabase account.
2. Select the appropriate BM type (TAL, EM, …) in **Settings**.
3. Choose the current semester and click **Add Grade** on a subject card.
4. Enter the control grade and its weight; the app instantly recalculates the semester average.

### Simulating Future Grades
- Open the **Semester Simulator** on a subject card.
- Add planned controls (grade + weight) and see the projected average.
- The simulator also updates the **Promotion Status** according to BM‑1 rules.

### Scanning Documents
1. Navigate to **Document Scanner**.
2. Upload a JPEG/PNG/PDF of a report card or SAL screenshot.
3. The backend forwards the image to Claude; extracted grades appear for review.
4. Confirm the results – they are automatically persisted.

## Advanced Usage
- **Export data**: Settings → **Export → CSV** to back up your grades.
- **Import data**: Settings → **Import → CSV** to restore a backup.
- **Custom weight formats**: You may use `1/2`, `50%` or plain numbers; the parser normalises them.
- **API access**: The Supabase client (`src/services/supabaseClient.js`) can be used in external scripts for bulk operations.

## Development
```bash
# Run linting continuously (optional)
npm run lint -- --watch

# Run unit tests (once they exist)
npm test
```
All UI components follow the **Tailwind Design System** defined in `tailwind.config.js`. New components should live in `src/components/` and be exported via `index.js` for reuse.

## Testing
- **ESLint** must pass (`npm run lint`).
- **Jest + React Testing Library** – add tests for `calculationService.js` and the custom hooks.
- CI pipeline (GitHub Actions) will run lint + tests on every push.

## Deployment
### Frontend
```bash
npm run build
# Deploy the `dist/` folder to Vercel, Netlify or any static host.
```
### Serverless API
- Deploy `api/scan.js` as a Vercel Function or Netlify Serverless Function.
- Set environment variables (`CLAUDE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) in the hosting dashboard.
### Supabase
- Apply migrations in production with `supabase db push`.
- Review RLS policies after schema changes.

## Security Considerations
- **Never commit** `service_role` keys; they belong only on the server.
- The `/api/scan` endpoint enforces rate‑limiting and requires a valid Supabase JWT.
- CORS headers are whitelisted to the domains listed in `vercel.json`.
- Regularly audit policies via `supabase policy list`.

## FAQ
**Q:** *Can I use the app offline?*\
**A:** The UI runs entirely in the browser, but persistence requires an internet connection to Supabase.

**Q:** *What if my Claude API quota is exceeded?*\
**A:** Scans will fail with a 429 error; the UI shows a friendly message and suggests retrying later.

**Q:** *How are grades rounded?*\
**A:** BM grades are rounded to the nearest 0.5 point; EFZ calculations use a 0.1‑point rounding for school‑part and final grades.

## Contributing
1. Fork the repository.
2. Create a feature branch (`git checkout -b feat/awesome‑feature`).
3. Install dependencies and run lint/tests.
4. Commit with clear messages (`git commit -m "feat: add awesome feature"`).
5. Open a Pull Request targeting `main`.

All contributions must update the **Documentation** (`CLAUDE.md` and `README.md`) if they affect public behavior.

## License
This project is **proprietary** and intended for educational use only. See `LICENSE` for details.

## Support
- Open an issue on the GitHub repository.
- Email the development team at `support@schulnetz.ch`.
- Join the community Discord channel (link in the repo README).

---
*Last updated: May 2026*
