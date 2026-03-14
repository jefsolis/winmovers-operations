# WinMovers Operations — Terraform Infrastructure

This directory contains the Terraform configuration that replicates the Azure infrastructure used by the WinMovers Operations application.

## Resources Created

| Resource | Name | Notes |
|---|---|---|
| Resource Group | `winmovers-rg` | All resources are grouped here |
| Container Registry | `<acr_name>` | Stores Docker images (Basic SKU) |
| App Service Plan | `winmovers-rg-plan` | Linux, B1 SKU |
| App Service | `winmovers-ops-2026` | Web App for Containers, system-assigned managed identity |
| ACR Pull Role | — | Grants the App Service managed identity permission to pull from ACR |
| Storage Account | `<storage_account_name>` | Blob storage for file attachments |
| Blob Container | `job-files` | Private container for moving-file attachments |
| PostgreSQL Flexible Server | `<postgres_server_name>` | Azure Database for PostgreSQL |
| PostgreSQL Database | `winmovers` | Initial database, used by Prisma |
| Log Analytics Workspace | `winmovers-logs` | Backing workspace for Application Insights |
| Application Insights | `winmovers-ops-ai` | App telemetry & monitoring |

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.3
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) — for authentication
- An Azure subscription with Contributor rights (or targeted RBAC on the resource group)

## Quick Start

### 1. Authenticate to Azure

```bash
az login
# Select the correct subscription if you have multiple:
az account set --subscription "<SUBSCRIPTION_ID>"
```

### 2. Configure Variables

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` and fill in all required values:

| Variable | Description |
|---|---|
| `acr_name` | Globally unique name for the Container Registry |
| `storage_account_name` | Globally unique name for the Storage Account |
| `postgres_server_name` | Globally unique name for the PostgreSQL server |
| `postgres_admin_login` | PostgreSQL admin username |
| `postgres_admin_password` | PostgreSQL admin password (strong, see [requirements](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-authentication)) |

> ⚠️ **Never commit `terraform.tfvars`** — it contains sensitive credentials. It is already in `.gitignore`.

### 3. Initialize Terraform

```bash
terraform init
```

This downloads the `azurerm` and `random` providers.

### 4. Preview the Plan

```bash
terraform plan
```

Review the output to verify that the expected resources will be created.

### 5. Apply

```bash
terraform apply
```

Type `yes` to confirm. The apply takes approximately 5–10 minutes (PostgreSQL provisioning is the slowest step).

### 6. Review Outputs

After a successful apply, Terraform prints the outputs. Sensitive values can be retrieved with:

```bash
terraform output -json
```

Key outputs:

| Output | Use |
|---|---|
| `app_url` | Public URL of the app (`https://<app_name>.azurewebsites.net`) |
| `acr_login_server` | ACR login server for the CI/CD workflow |
| `acr_name` | Value for the `ACR_NAME` GitHub Actions secret |
| `postgres_database_url` | Full `DATABASE_URL` connection string for Prisma |
| `storage_primary_connection_string` | `AZURE_STORAGE_CONNECTION_STRING` for the backend |
| `github_actions_secrets_summary` | Summary of GitHub Actions secrets to configure |

### 7. Configure GitHub Actions Secrets

After the infrastructure is created, set the following secrets in your GitHub repository  
(**Settings → Secrets and variables → Actions**):

```
ACR_NAME       = <terraform output acr_name>
AZURE_APP_ID   = <service principal appId>
AZURE_PASSWORD = <service principal password>
AZURE_TENANT   = <your Azure tenant ID>
```

To create a service principal with the required permissions:

```bash
az ad sp create-for-rbac \
  --name winmovers-cicd \
  --role Contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/winmovers-rg
```

The command outputs `appId`, `password`, and `tenant` — map these to the secrets above.

## Updating Infrastructure

To update existing resources, modify the Terraform files and re-run:

```bash
terraform plan   # preview changes
terraform apply  # apply changes
```

## Destroying Infrastructure

> ⚠️ This will **permanently delete** all data (database, blobs, etc.).

```bash
terraform destroy
```

## Remote State (Recommended for Teams)

For production use, store the Terraform state in Azure Blob Storage instead of locally:

```hcl
# Add to terraform/versions.tf inside the terraform block:
backend "azurerm" {
  resource_group_name  = "winmovers-rg"
  storage_account_name = "<state_storage_account_name>"
  container_name       = "tfstate"
  key                  = "winmovers-ops.tfstate"
}
```

Create the state storage account before running `terraform init`:

```bash
az group create --name winmovers-rg --location centralus
az storage account create \
  --name <state_storage_account_name> \
  --resource-group winmovers-rg \
  --sku Standard_LRS
az storage container create \
  --name tfstate \
  --account-name <state_storage_account_name>
```

## Architecture Notes

- The App Service uses a **system-assigned managed identity** with `AcrPull` role on the ACR, so no registry credentials are stored in the app settings.
- The PostgreSQL Flexible Server has a firewall rule allowing all Azure service IPs (`0.0.0.0/0.0.0.0`). For higher security, consider [VNet integration](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-networking-private).
- The `docker_image_name` app setting is set to `ignore_changes` in the lifecycle block so that CI/CD image updates (via `az webapp config container set`) are not overwritten by Terraform on the next apply.
- Sensitive outputs (`postgres_database_url`, `storage_primary_connection_string`, etc.) are already injected into the App Service `app_settings` by Terraform, so you do not need to set them manually.
