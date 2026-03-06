# Cost Calculator V2

Multi-quantity, multi-component, multi-supplier quote engine for label printing.

## Local Development

```bash
npm install
npm run dev
```

Open the local URL shown in terminal (usually `http://localhost:5173`).

## Build

```bash
npm run build
```

## Deploy to GitHub Pages

This project is already configured for GitHub Pages:
- Uses `HashRouter` (route-safe on Pages)
- Uses GitHub Actions workflow at `.github/workflows/deploy.yml`
- Automatically computes Vite `base` in CI from repo name

### One-time setup

1. Push this project to GitHub.
2. In GitHub repo: `Settings -> Pages`.
3. Set `Source` to **GitHub Actions**.
4. Ensure your default branch is `main` (or `master`).

### Deploy

- Push to `main` or `master`.
- GitHub Action runs build and deploys automatically.

### URL format

Your app URL will be:

`https://<github-username>.github.io/<repo-name>/#/`

Example:

`https://faati.github.io/cost-calculator-v2/#/`

## Notes

- Data is stored in browser `localStorage`.
- Export to Excel is client-side.
- For sharing with colleagues, send the GitHub Pages URL.
