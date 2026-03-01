# WinMovers - Operations

This repository contains a minimal full-stack scaffold: a React frontend (Vite) and a Node.js + Express backend that can serve the built frontend. The goal is to produce a working "Hello World" app and deploy it to Azure App Service.

Quick file overview:
- frontend/: Vite + React app
- backend/: Express API and static server

Local development
1. Install Node.js (18+ recommended).
2. Open two shells.

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend (API):

```bash
cd backend
npm install
npm run start
```

To run locally as a single app (build frontend and serve from backend):

```bash
cd backend
npm install
cd ../frontend && npm install && npm run build
cd ../backend
node index.js
```

Verify:
- React app: http://localhost:5173 (dev) or http://localhost:3000 (served build)
- API: http://localhost:3000/api/hello

Azure account and service setup (detailed)

1) Create an Azure account
- Visit https://azure.microsoft.com and click "Start free". Follow the sign-up flow.
- You'll need to provide identity verification (phone + credit card). The free tier provides credits for new accounts.
- After sign-up you will have an Azure subscription visible in the Azure portal.

2) Install Azure CLI
- Windows (PowerShell):

```powershell
winget install --id Microsoft.AzureCLI -e --source winget
# or follow https://learn.microsoft.com/cli/azure/install-azure-cli
az version
```

3) Login to Azure from CLI

```bash
az login
```

This opens a browser for authentication and will list subscriptions. If you have multiple subscriptions, set the default:

```bash
az account set --subscription "<your-subscription-id-or-name>"
```

4) Create resource group and App Service plan

Replace `<RG>` and `<LOCATION>` and `<APP_NAME>` with your values.

```bash
az group create --name winmovers-rg --location eastus
az appservice plan create --name winmovers-rg-plan --resource-group winmovers-rg --sku B1 --is-linux --location centralus
```

5) Create Web App (Linux) with Node runtime

```bash
az webapp create --resource-group winmovers-rg --plan winmovers-rg-plan --name winmovers-ops-2026 --runtime "NODE:20-lts"
```

6) Prepare app for deployment

Build the frontend and ensure backend `index.js` and `package.json` are present in the deployment folder (we will deploy the backend root which serves the frontend build):

```bash
cd frontend
npm install
npm run build
cd ../backend
npm install
```

7) Deploy using `az webapp deploy` (ZIP deploy)

From the `backend` folder (so the server files and `node_modules`/package.json are included):

```bash
cd backend
az webapp deploy --resource-group winmovers-rg --name winmovers-ops-2026 --src-path C:\Workspace\winmovers-operations\backend --type zip
```

# create zip (overwrites if exists)
```bash
Remove-Item C:\temp\winmovers-deploy.zip -ErrorAction SilentlyContinue
Compress-Archive -Path C:\Workspace\winmovers-operations\backend\* -DestinationPath C:\temp\winmovers-deploy.zip -Force

# deploy the zip
az webapp deploy --resource-group winmovers-rg --name winmovers-ops-2026 --src-path C:\temp\winmovers-deploy.zip --type zip
```

8) Environment/ports
- Azure App Service sets `PORT` environment variable; our Express server uses it by default.

9) Verify
- Open the app in a browser:

```bash
az webapp browse --name winmovers-ops-2026 --resource-group winmovers-rg

curl https://winmovers-ops-2026.azurewebsites.net/api/hello
```

You can also call the API endpoint:

```bash
curl https://winmovers-ops-2026.azurewebsites.net/api/hello
```

Optional: CI/CD with GitHub Actions
- You can set up a GitHub Actions workflow to build the frontend, build the backend, and deploy to Azure automatically. Azure portal can generate sample workflow files for you.

Troubleshooting
- If the site returns 500 after deploy, check logs:

```bash
az webapp log tail --name <APP_NAME> --resource-group <RG>
```

- Ensure your `start` script in `backend/package.json` is `node index.js`.

Next steps I can do for you
- Create a GitHub Actions workflow for deployment.
- Deploy directly from this workspace using the Azure CLI.
- Configure HTTPS, custom domain, or separate static hosting for the frontend.

1) Enable build-on-deploy so Kudu will run npm install on Linux
```bash
az webapp config appsettings set --resource-group winmovers-rg --name winmovers-ops-2026 --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true
```

2) Build frontend locally (keep frontend/dist current)
```bash
cd C:\Workspace\winmovers-operations\frontend
npm install
npm run build
```

3) Create a clean deployment folder that EXCLUDES node_modules
```bash
$src = 'C:\Workspace\winmovers-operations\backend'
$deployDir = 'C:\temp\winmovers-deploy'
Remove-Item $deployDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $deployDir
Get-ChildItem -Path $src -Force | Where-Object { $_.Name -ne 'node_modules' } | ForEach-Object {
  Copy-Item $_.FullName -Destination $deployDir -Recurse -Force
}
```

4) Zip the clean folder and deploy the zip
```bash
$zip = 'C:\temp\winmovers-deploy.zip'
Remove-Item $zip -Force -ErrorAction SilentlyContinue
Compress-Archive -Path "$deployDir\*" -DestinationPath $zip -Force
az webapp deploy --resource-group winmovers-rg --name winmovers-ops-2026 --src-path $zip --type zip
```

5) Tail logs to watch startup
```bash
az webapp log tail --resource-group winmovers-rg --name winmovers-ops-2026
```




# Set variables (edit if different)
```bash
$RG = "winmovers-rg"
$APP = "winmovers-ops-2026"
$SRC_ROOT = "C:\Workspace\winmovers-operations"
$FRONTEND = Join-Path $SRC_ROOT "frontend"
$BACKEND = Join-Path $SRC_ROOT "backend"
$TMP_DIR = "C:\temp\winmovers-deploy"
$ZIP = "C:\temp\winmovers-deploy.zip"
```

1) Build frontend
```bash
cd $FRONTEND
npm install
npm run build
```

2) Prepare backend deployment folder (exclude node_modules), copy built frontend into backend/frontend
```bash
Remove-Item $TMP_DIR -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $TMP_DIR -Force | Out-Null

# Copy backend files except node_modules into temp folder
Get-ChildItem -Path $BACKEND -Force | Where-Object { $_.Name -ne 'node_modules' } | ForEach-Object {
  if ($_.PsIsContainer) { Copy-Item -Path $_.FullName -Destination $TMP_DIR -Recurse -Force }
  else { Copy-Item -Path $_.FullName -Destination $TMP_DIR -Force }
}

# Copy frontend build into the backend folder inside temp
$TMP_BACKEND_FRONTEND = Join-Path $TMP_DIR "frontend"
Remove-Item $TMP_BACKEND_FRONTEND -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $TMP_BACKEND_FRONTEND -Force | Out-Null
Copy-Item -Path (Join-Path $FRONTEND "dist\*") -Destination $TMP_BACKEND_FRONTEND -Recurse -Force
```

3) Create ZIP of temp folder
```bash
Remove-Item $ZIP -Force -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $TMP_DIR "*") -DestinationPath $ZIP -Force
Write-Host "ZIP created at $ZIP"
```

4) Ensure Kudu will build on Linux host (safer) — optional but recommended
```bash
az webapp config appsettings set --resource-group $RG --name $APP --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true
```

5) Deploy the ZIP
```bash
az webapp deploy --resource-group $RG --name $APP --src-path $ZIP --type zip
```

6) Stream logs to watch startup (open in separate shell if you want)
```bash
az webapp log tail --resource-group $RG --name $APP
```

7) Verify site and API (after logs show healthy)
```bash
az webapp browse --resource-group $RG --name $APP
# or
curl https://$APP.azurewebsites.net/api/hello
```