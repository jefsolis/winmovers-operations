**WinMovers - Operations — Docker + Azure App Service Deployment Guide**

Overview
- **Purpose**: Step-by-step instructions to build the repository into a single Docker image, push it to Azure Container Registry (ACR), and run it on an Azure App Service (Web App for Containers).
- **Assumptions**: You have CLI access with permission to the target subscription, and you created the resource group `winmovers-rg` and the App Service `winmovers-ops-2026` during the lab.

Files referenced
- **Dockerfile**: [Dockerfile](Dockerfile) — multi-stage build that compiles the frontend, copies it into the backend, and produces a Node runtime image.
- **Backend entry**: [backend/index.js](backend/index.js) — Express server that serves `/api/hello` and static frontend files.

Prerequisites
- **Local**: `git`, `node` (or npm), `docker` (Docker Desktop), and `az` (Azure CLI) installed and authenticated (`az login`).
- **Azure**: A subscription where you can create a Container Registry and App Service. App must be Linux / Web App for Containers.

Local build & test (quick)
- **Install deps & build frontend** (if editing locally):
```powershell
cd frontend
npm ci
npm run build
```
- **Copy built frontend for local backend test** (optional):
```powershell
rm -rf backend/frontend
mkdir backend\frontend
cp -r frontend\dist\* backend\frontend\
```
- **Run backend locally**:
```powershell
cd backend
npm ci
node index.js
# open http://localhost:3000 and http://localhost:3000/api/hello
```

Docker image: build and run locally
- **Build image** (from repo root):
```powershell
docker build -t winmovers-ops:latest .
```
- **Run locally** (map container port 8080 to host):
```powershell
docker run --rm -p 8080:8080 --name winmovers-test winmovers-ops:latest
# then test: http://localhost:8080 and http://localhost:8080/api/hello
```

Push image to Azure Container Registry (ACR)
1. Create ACR (one-time):
```powershell
# choose a globally-unique name (lowercase)
az acr create --resource-group winmovers-rg --name <ACR_NAME> --sku Basic --location centralus
```
2. Tag and push the image:
```powershell
docker tag winmovers-ops:latest <ACR_NAME>.azurecr.io/winmovers-ops:v1
az acr login --name <ACR_NAME>
docker push <ACR_NAME>.azurecr.io/winmovers-ops:v1
```
3. Verify repository & tags:
```powershell
az acr repository list --name <ACR_NAME> -o table
az acr repository show-tags --name <ACR_NAME> --repository winmovers-ops -o table
```

Configure App Service to run the container
1. Ensure Web App is Linux and supports containers. If not, recreate or change plan.
2. Give the Web App a system-assigned managed identity and grant `AcrPull` on the ACR (recommended):
```powershell
az webapp identity assign --resource-group winmovers-rg --name winmovers-ops-2026
$principalId = az webapp show -g winmovers-rg -n winmovers-ops-2026 --query identity.principalId -o tsv
$acrId = az acr show --name <ACR_NAME> --resource-group winmovers-rg --query id -o tsv
az role assignment create --assignee $principalId --role AcrPull --scope $acrId
```
3. Tell the Web App to use the managed identity for ACR pulls:
```powershell
az webapp update --resource-group winmovers-rg --name winmovers-ops-2026 --set siteConfig.acrUseManagedIdentityCreds=true
```
4. Point the Web App to the container image and restart:
```powershell
az webapp config container set --resource-group winmovers-rg --name winmovers-ops-2026 --container-image-name <ACR_NAME>.azurecr.io/winmovers-ops:v1
az webapp restart --resource-group winmovers-rg --name winmovers-ops-2026
```

Important: WEBSITE_RUN_FROM_PACKAGE
- If you previously used ZIP/Run‑From‑Package deployments, you must remove the `WEBSITE_RUN_FROM_PACKAGE` (or `WEBSITE_RUN_FROM_ZIP`) app setting before running a custom container. App Service cannot both mount a package and run a custom container.
```powershell
az webapp config appsettings delete --resource-group winmovers-rg --name winmovers-ops-2026 --setting-names WEBSITE_RUN_FROM_PACKAGE WEBSITE_RUN_FROM_ZIP
az webapp restart --resource-group winmovers-rg --name winmovers-ops-2026
```

App settings (container port)
- The Dockerfile sets `PORT=8080` and exposes `8080`. Ensure App Service knows the container port:
```powershell
az webapp config appsettings set --resource-group winmovers-rg --name winmovers-ops-2026 --settings WEBSITES_PORT=8080
az webapp restart --resource-group winmovers-rg --name winmovers-ops-2026
```

Verify & logs
- Tail live logs:
```powershell
az webapp log tail --resource-group winmovers-rg --name winmovers-ops-2026
```
- Download logs for offline analysis:
```powershell
az webapp log download --resource-group winmovers-rg --name winmovers-ops-2026 --log-file C:\temp\site_logs.zip
```

Troubleshooting (common errors)
- **ImagePullUnauthorizedFailure**: App can't authenticate to ACR. Fix by granting `AcrPull` to the Web App managed identity or use ACR admin creds.
- **ImageNotFoundFailure**: Tag missing. Check repo tags with `az acr repository show-tags` and re-push the correct tag.
- **BadRunFromPackageConfig / VolumeMountFailure**: App is still configured to mount a ZIP package. Remove `WEBSITE_RUN_FROM_PACKAGE` before switching to a container.
- **Container starts locally but fails on App Service**: Check `WEBSITES_PORT`, container logs in Portal → Log stream, and the app settings.

Optional: fallback using ACR admin user (less secure)
```powershell
az acr update --name <ACR_NAME> --resource-group winmovers-rg --admin-enabled true
$creds = az acr credential show --name <ACR_NAME> -o json
$u = ($creds | ConvertFrom-Json).username
$p = ($creds | ConvertFrom-Json).passwords[0].value
az webapp config container set --resource-group winmovers-rg --name winmovers-ops-2026 --container-image-name <ACR_NAME>.azurecr.io/winmovers-ops:v1 --docker-registry-server-url https://<ACR_NAME>.azurecr.io --docker-registry-server-user $u --docker-registry-server-password $p
az webapp restart --resource-group winmovers-rg --name winmovers-ops-2026
```

CI recommendation (GitHub Actions) — brief example
- Use Actions to build, log in to ACR, push, and update the Web App (or update a container image setting). The workflow can use `azure/login` and `azure/cli` or `azure/webapps-deploy` for non-container deployments. For containers prefer using `docker/build-push-action` + `azure/cli` to set the container image.

Minimal workflow sketch (store secrets `AZURE_CREDENTIALS` and `ACR_NAME`):
```yaml
name: Build and deploy container
on: [push]
jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and push image
        uses: docker/build-push-action@v4
        with:
          push: true
          tags: ${{ secrets.ACR_NAME }}.azurecr.io/winmovers-ops:latest
      - name: Azure CLI - set webapp container
        uses: azure/cli@v1
        with:
          azcliversion: 'latest'
          inlineScript: |
            az login --service-principal -u ${{ secrets.AZURE_APP_ID }} -p ${{ secrets.AZURE_PASSWORD }} --tenant ${{ secrets.AZURE_TENANT }}
            az acr login --name ${{ secrets.ACR_NAME }}
            az webapp config container set --resource-group winmovers-rg --name winmovers-ops-2026 --container-image-name ${{ secrets.ACR_NAME }}.azurecr.io/winmovers-ops:latest
            az webapp restart --resource-group winmovers-rg --name winmovers-ops-2026
```

Additional notes
- Keep the container image small (multi-stage builds are used in `Dockerfile`).
- Prefer managed identity over ACR admin creds for security. Role assignment propagation can take ~30–60s.
- If you need to serve static assets directly from the App Service wwwroot instead of a container, use ZIP deploy and `WEBSITE_RUN_FROM_PACKAGE` (don't mix both).

**Enable Application Insights (optional, recommended)**
- Create an Application Insights resource to collect telemetry and add its instrumentation key/connection string to your Web App settings.
- CLI example (one-time):
```powershell
az monitor app-insights component create --app winmovers-ops-ai --location centralus --resource-group winmovers-rg --application-type web
INSTRUMENTATION_KEY=$(az monitor app-insights component show -g winmovers-rg -n winmovers-ops-ai --query instrumentationKey -o tsv)
CONNECTION_STRING=$(az monitor app-insights component show -g winmovers-rg -n winmovers-ops-ai --query connectionString -o tsv)
az webapp config appsettings set --resource-group winmovers-rg --name winmovers-ops-2026 --settings APPINSIGHTS_INSTRUMENTATIONKEY=$INSTRUMENTATION_KEY APPLICATIONINSIGHTS_CONNECTION_STRING=$CONNECTION_STRING
az webapp restart --resource-group winmovers-rg --name winmovers-ops-2026
```

- The GitHub Actions workflow includes a step that will create/ensure the Application Insights component and populate the app settings. The workflow requires the following repository secrets to be configured:
  - `AZURE_APP_ID` — service principal appId
  - `AZURE_PASSWORD` — service principal password
  - `AZURE_TENANT` — tenant id
  - `ACR_NAME` — your registry name (used as `<ACR_NAME>.azurecr.io`)
  - `ACR_USERNAME` and `ACR_PASSWORD` (only if using ACR admin creds; optional when using managed identity)

Make sure to create a service principal and grant it appropriate permissions (role assignments) in your subscription so the workflow can create Application Insights and update the App Service. See Azure docs for `az ad sp create-for-rbac` examples.

If you'd like, I can also add this guide to the repository `README.md` or create the GitHub Actions workflow file in `.github/workflows/` — tell me which and I'll create it.
