# Azure Tenant Migration Guide — WinMovers Operations

Complete guide for migrating all WinMovers infrastructure from the current Azure tenant to a new one.

---

## Current Resource Inventory

| Resource | Type | Name / Details |
|---|---|---|
| Resource Group | `Microsoft.Resources/resourceGroups` | `winmovers-rg` (eastus) |
| App Service Plan | `Microsoft.Web/serverfarms` | `winmovers-rg-plan` (Linux, B1, centralus) |
| App Service | `Microsoft.Web/sites` | `winmovers-ops-2026` (Web App for Containers) |
| Container Registry | `Microsoft.ContainerRegistry/registries` | `<ACR_NAME>` (Basic SKU, centralus) |
| Storage Account | `Microsoft.Storage/storageAccounts` | (parsed from `AZURE_STORAGE_CONNECTION_STRING`) |
| Blob Container | Storage container | `job-files` (or `AZURE_STORAGE_CONTAINER` value) |
| PostgreSQL | Database | (parsed from `DATABASE_URL`) |
| Service Principal | `Microsoft.Entra` | App ID = `AZURE_APP_ID` |

### Environment Variables / Secrets

| Secret | Where Used | What It Is |
|---|---|---|
| `DATABASE_URL` | GitHub Actions + App Service | PostgreSQL connection string |
| `AZURE_STORAGE_CONNECTION_STRING` | App Service | Storage account name + key |
| `AZURE_STORAGE_CONTAINER` | App Service | Blob container name (default: `job-files`) |
| `ACR_NAME` | GitHub Actions | Container Registry name (without `.azurecr.io`) |
| `AZURE_APP_ID` | GitHub Actions | Service principal client ID |
| `AZURE_PASSWORD` | GitHub Actions | Service principal client secret |
| `AZURE_TENANT` | GitHub Actions | Azure AD tenant ID |

---

## Should You Use Terraform?

**For this project, Terraform is optional but recommended for the new tenant.**

Pros:
- Reproducible setup — run once and all resources are created consistently
- Documents your infrastructure as code for future reference
- Easy to tear down or recreate if something goes wrong

Cons:
- Learning curve if you haven't used it before
- The current setup has no Terraform files, so you'd write them from scratch

**Recommended approach:** Use the Azure CLI script below (faster for a one-time migration), and optionally adopt Terraform for the new tenant going forward. A Terraform configuration is included at the end of this document.

---

## Migration Steps

### Phase 1 — Inventory & Export from Old Tenant

#### 1.1 Export Blob Storage Data

This is the most critical step — blob data contains customer file attachments.

```powershell
# Install AzCopy if not already available
# https://learn.microsoft.com/en-us/azure/storage/common/storage-use-azcopy-v10

# Option A: AzCopy (fastest for large volumes)
# Generate a SAS token for the SOURCE container (old tenant)
$sourceSas = az storage container generate-sas `
  --account-name <OLD_STORAGE_ACCOUNT> `
  --name job-files `
  --permissions rl `
  --expiry (Get-Date).AddDays(7).ToString("yyyy-MM-ddTHH:mm:ssZ") `
  --output tsv

# List blobs to verify (optional)
az storage blob list --account-name <OLD_STORAGE_ACCOUNT> --container-name job-files --sas-token $sourceSas --output table

# Download everything locally as backup
azcopy copy "https://<OLD_STORAGE_ACCOUNT>.blob.core.windows.net/job-files?$sourceSas" "C:\backup\blob-files" --recursive
```

#### 1.2 Export PostgreSQL Database

```powershell
# Option A: pg_dump (if you have direct access)
pg_dump "<OLD_DATABASE_URL>" --format=custom --file="C:\backup\winmovers-db.dump"

# Option B: If using Azure Database for PostgreSQL
az postgres flexible-server backup create `
  --resource-group winmovers-rg `
  --name <OLD_PG_SERVER> `
  --backup-name pre-migration-backup
```

#### 1.3 Export Container Image (optional safety net)

```powershell
# Pull the current image locally
az acr login --name <OLD_ACR_NAME>
docker pull <OLD_ACR_NAME>.azurecr.io/winmovers-ops:latest
docker tag <OLD_ACR_NAME>.azurecr.io/winmovers-ops:latest winmovers-ops:migration-backup
```

#### 1.4 Document Current App Service Settings

```powershell
# Export all app settings
az webapp config appsettings list `
  --resource-group winmovers-rg `
  --name winmovers-ops-2026 `
  --output json > C:\backup\app-settings.json

# Export general config
az webapp config show `
  --resource-group winmovers-rg `
  --name winmovers-ops-2026 `
  --output json > C:\backup\app-config.json
```

---

### Phase 2 — Create Resources in New Tenant

Login to the new tenant:

```powershell
az login --tenant <NEW_TENANT_ID>
```

#### 2.1 Resource Group

```powershell
az group create --name Sistema --location centralus
```

#### 2.2 Container Registry

az provider register --namespace Microsoft.ContainerRegistry
az provider register --namespace Microsoft.Web
az provider register --namespace Microsoft.DBforPostgreSQL
az provider register --namespace Microsoft.Storage

```powershell
az acr create `
  --resource-group Sistema `
  --name winmoversops `
  --sku Basic `
  --location centralus
```

#### 2.3 App Service Plan + Web App

```powershell
# Create Linux plan
az appservice plan create `
  --resource-group Sistema `
  --name winmovers-rg-plan `
  --is-linux `
  --sku B1 `
  --location centralus

# Create Web App for Containers
az webapp create `
  --resource-group Sistema `
  --plan winmovers-rg-plan `
  --name winmoversops-app `
  --container-image-name winmoversops.azurecr.io/winmovers-ops:latest

# Configure port
az webapp config appsettings set `
  --resource-group Sistema `
  --name winmoversops-app `
  --settings WEBSITES_PORT=8080
```

#### 2.4 Storage Account + Blob Container

```powershell
az storage account create `
  --resource-group Sistema `
  --name winmoversopsfile `
  --sku Standard_LRS `
  --location centralus

az storage container create `
  --account-name winmoversopsfile `
  --name job-files
```

#### 2.5 PostgreSQL

```powershell
# Azure Database for PostgreSQL Flexible Server
az postgres flexible-server create `
  --resource-group Sistema `
  --name winmoversopsdb `
  --location centralus `
  --admin-user winmoversadmin `
  --admin-password "<STRONG_PASSWORD>" `
  --sku-name Standard_B1ms `
  --tier Burstable `
  --storage-size 32 `
  --version 16

# Create the database
az postgres flexible-server db create `
  --resource-group Sistema `
  --server-name winmoversopsdb `
  --database-name winmovers

# Allow Azure services to connect
az postgres flexible-server firewall-rule create `
  --resource-group Sistema `
  --name winmoversopsdb `
  --rule-name AllowAzureServices `
  --start-ip-address 0.0.0.0 `
  --end-ip-address 0.0.0.0
```

#### 2.6 Service Principal for CI/CD

```powershell
# Create a service principal scoped to the resource group
$sp = az ad sp create-for-rbac `
  --name "winmovers-ci" `
  --role contributor `
  --scopes /subscriptions/90116589-6b05-4070-a37e-aba73407b2e9/resourceGroups/Sistema `
  --output json | ConvertFrom-Json

# Grant AcrPush on the registry (for image push)
az role assignment create `
  --assignee $sp.appId `
  --role AcrPush `
  --scope $(az acr show --name winmoversops --query id --output tsv)

# Save these — you'll need them for GitHub secrets:
# appId     → AZURE_APP_ID
# password  → AZURE_PASSWORD
# tenant    → AZURE_TENANT
Write-Host "APP_ID:   $($sp.appId)"
Write-Host "PASSWORD: $($sp.password)"
Write-Host "TENANT:   $($sp.tenant)"
```

---

### Phase 3 — Restore Data

#### 3.1 Restore PostgreSQL

```powershell
# Get the new connection string
$newDbUrl = "postgresql://winmoversadmin:<PASSWORD>@winmoversops-db.postgres.database.azure.com:5432/winmovers?sslmode=require"

# Restore from dump
pg_restore --dbname="$newDbUrl" --no-owner --no-acl "C:\backup\winmovers-db.dump"

# OR if starting fresh, push the schema only:
Set-Location C:\Workspace\winmovers-operations\backend
$env:DATABASE_URL = $newDbUrl
npx prisma db push
```

#### 3.2 Restore Blob Storage

```powershell
# Generate SAS for the NEW container
$destSas = az storage container generate-sas `
  --account-name <NEW_STORAGE_ACCOUNT> `
  --name job-files `
  --permissions rwl `
  --expiry (Get-Date).AddDays(7).ToString("yyyy-MM-ddTHH:mm:ssZ") `
  --output tsv

# Upload from local backup
azcopy copy "C:\backup\blob-files\job-files\*" "https://<NEW_STORAGE_ACCOUNT>.blob.core.windows.net/job-files?$destSas" --recursive

# OR direct copy between accounts (if both accessible):
azcopy copy `
  "https://<OLD_STORAGE_ACCOUNT>.blob.core.windows.net/job-files?$sourceSas" `
  "https://<NEW_STORAGE_ACCOUNT>.blob.core.windows.net/job-files?$destSas" `
  --recursive
```

#### 3.3 Push Container Image to New ACR

docker build -t winmoversops.azurecr.io/winmovers-ops:latest .

```powershell
az acr login --name winmoversops
docker tag winmovers-ops:migration-backup winmoversops.azurecr.io/winmovers-ops:latest
docker push winmoversops.azurecr.io/winmovers-ops:latest
```

---

### Phase 4 — Configure App Service

```powershell
# Get the new storage connection string
$storageConn = az storage account show-connection-string `
  --resource-group Sistema `
  --name winmoversopsfile `
  --output tsv

# Set all environment variables
az webapp config appsettings set `
  --resource-group Sistema `
  --name winmoversops-app `
  --settings `
    DATABASE_URL="postgresql://winmoversadmin:<PASSWORD>@winmoversopsdb.postgres.database.azure.com:5432/winmovers?sslmode=require" `
    AZURE_STORAGE_CONNECTION_STRING="$storageConn" `
    AZURE_STORAGE_CONTAINER="job-files" `
    WEBSITES_PORT="8080" `
    NODE_ENV="production"

# Point Web App to the new ACR
az webapp config container set `
  --resource-group Sistema `
  --name winmoversops-app `
  --container-image-name winmoversops.azurecr.io/winmovers-ops:latest `
  --container-registry-url https://winmoversops.azurecr.io `
  --container-registry-user $sp.appId `
  --container-registry-password $sp.password

# Grant managed identity AcrPull (recommended over credentials)
az webapp identity assign `
  --resource-group Sistema `
  --name winmoversops-app

$principalId = az webapp identity show `
  --resource-group Sistema `
  --name winmoversops-app `
  --query principalId --output tsv

az role assignment create `
  --assignee $principalId `
  --role AcrPull `
  --scope $(az acr show --name winmoversops --query id --output tsv)

# Restart
az webapp restart --resource-group Sistema --name winmoversops-app
```

---

### Phase 5 — Update GitHub Secrets

Go to **GitHub → Repository Settings → Secrets and variables → Actions** and update:

| Secret | New Value |
|---|---|
| `ACR_NAME` | `<NEW_ACR_NAME>` |
| `AZURE_APP_ID` | Service principal appId from step 2.6 |
| `AZURE_PASSWORD` | Service principal password from step 2.6 |
| `AZURE_TENANT` | New tenant ID |
| `DATABASE_URL` | New PostgreSQL connection string |

No changes needed in `ci-deploy.yml` — it already uses these secrets.

---

### Phase 6 — Verify

```powershell
# 1. Check Web App is running
az webapp show --resource-group winmovers-rg --name winmovers-ops-2026 --query state

# 2. Check logs
az webapp log tail --resource-group winmovers-rg --name winmovers-ops-2026

# 3. Test the site
Invoke-WebRequest -Uri "https://winmovers-ops-2026.azurewebsites.net/api/admin/counters" -Method GET

# 4. Verify blob storage — upload a test attachment via the UI

# 5. Trigger a CI/CD deploy by pushing a trivial commit to test the full pipeline
```

---

## Verification Checklist

- [ ] Web app loads at `https://winmovers-ops-2026.azurewebsites.net`
- [ ] Dashboard shows existing data (database restored)
- [ ] Existing file attachments are downloadable (blob storage restored)
- [ ] New file upload works (blob storage connection valid)
- [ ] Creating a new job generates correct sequential numbers
- [ ] Push to `main` triggers GitHub Actions successfully
- [ ] Container image builds and pushes to new ACR
- [ ] Web App restarts with the new image
- [ ] Administration page shows correct counters

---

## Optional: Terraform Configuration

If you want to manage the new tenant with Terraform going forward:

```hcl
# main.tf
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
  tenant_id       = var.tenant_id
  subscription_id = var.subscription_id
}

variable "tenant_id" { type = string }
variable "subscription_id" { type = string }
variable "pg_admin_password" { type = string; sensitive = true }
variable "acr_name" { type = string }
variable "storage_account_name" { type = string }
variable "pg_server_name" { type = string }

resource "azurerm_resource_group" "rg" {
  name     = "winmovers-rg"
  location = "centralus"
}

resource "azurerm_container_registry" "acr" {
  name                = var.acr_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "Basic"
  admin_enabled       = false
}

resource "azurerm_storage_account" "storage" {
  name                     = var.storage_account_name
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_storage_container" "files" {
  name                  = "job-files"
  storage_account_name  = azurerm_storage_account.storage.name
  container_access_type = "private"
}

resource "azurerm_postgresql_flexible_server" "pg" {
  name                   = var.pg_server_name
  resource_group_name    = azurerm_resource_group.rg.name
  location               = azurerm_resource_group.rg.location
  version                = "16"
  administrator_login    = "winmoversadmin"
  administrator_password = var.pg_admin_password
  sku_name               = "B_Standard_B1ms"
  storage_mb             = 32768
  zone                   = "1"
}

resource "azurerm_postgresql_flexible_server_database" "db" {
  name      = "winmovers"
  server_id = azurerm_postgresql_flexible_server.pg.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "azure" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.pg.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

resource "azurerm_service_plan" "plan" {
  name                = "winmovers-rg-plan"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  os_type             = "Linux"
  sku_name            = "B1"
}

resource "azurerm_linux_web_app" "app" {
  name                = "winmovers-ops-2026"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  service_plan_id     = azurerm_service_plan.plan.id

  site_config {
    container_registry_use_managed_identity = true
    application_stack {
      docker_image_name   = "${azurerm_container_registry.acr.login_server}/winmovers-ops:latest"
      docker_registry_url = "https://${azurerm_container_registry.acr.login_server}"
    }
  }

  app_settings = {
    WEBSITES_PORT                      = "8080"
    NODE_ENV                           = "production"
    DATABASE_URL                       = "postgresql://winmoversadmin:${var.pg_admin_password}@${azurerm_postgresql_flexible_server.pg.fqdn}:5432/winmovers?sslmode=require"
    AZURE_STORAGE_CONNECTION_STRING    = azurerm_storage_account.storage.primary_connection_string
    AZURE_STORAGE_CONTAINER            = "job-files"
  }

  identity {
    type = "SystemAssigned"
  }
}

resource "azurerm_role_assignment" "acr_pull" {
  scope                = azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_linux_web_app.app.identity[0].principal_id
}

output "app_url" {
  value = "https://${azurerm_linux_web_app.app.default_hostname}"
}

output "database_url" {
  value     = "postgresql://winmoversadmin:${var.pg_admin_password}@${azurerm_postgresql_flexible_server.pg.fqdn}:5432/winmovers?sslmode=require"
  sensitive = true
}

output "storage_connection_string" {
  value     = azurerm_storage_account.storage.primary_connection_string
  sensitive = true
}
```

Usage:
```powershell
terraform init
terraform plan -var="tenant_id=<NEW_TENANT>" -var="subscription_id=<NEW_SUB>" -var="acr_name=<NAME>" -var="storage_account_name=<NAME>" -var="pg_server_name=<NAME>" -var="pg_admin_password=<PASS>"
terraform apply
```

---

## Cleanup — Old Tenant

After verifying everything works in the new tenant:

```powershell
# Login to old tenant
az login --tenant <OLD_TENANT_ID>

# Delete everything (IRREVERSIBLE)
az group delete --name winmovers-rg --yes --no-wait
```

**Wait at least 1–2 weeks before deleting the old tenant resources** to ensure no issues surface in production.
