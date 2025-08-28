
# DriveDen GPS (Leaflet) — Single App

Runs a secure GolfIntelligence proxy and the web UI in one server.

## Run locally
1) Install Node.js 18+
2) In this folder:
   ```
   npm install
   ```
3) Start with your credentials (PowerShell on Windows):
   ```powershell
   $env:GI_BASE="https://api.golfintelligence.com"
   $env:GI_CLIENT_ID="YOUR_CLIENT_ID"
   $env:GI_API_TOKEN="YOUR_API_TOKEN"
   npm start
   ```
   Mac/Linux:
   ```bash
   GI_BASE="https://api.golfintelligence.com" GI_CLIENT_ID="YOUR_CLIENT_ID" GI_API_TOKEN="YOUR_API_TOKEN" npm start
   ```
4) Open http://localhost:8080

## Deploy (Railway)
Create a Railway project from a GitHub repo with these files, set env vars above, deploy.
