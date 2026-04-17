# -----------------------------------------------------------------------
# App Service
# -----------------------------------------------------------------------
output "app_url" {
  description = "Public URL of the deployed App Service."
  value       = "https://${azurerm_linux_web_app.app.default_hostname}"
}

output "app_name" {
  description = "App Service name (also the subdomain: <app_name>.azurewebsites.net)."
  value       = azurerm_linux_web_app.app.name
}

# -----------------------------------------------------------------------
# Azure Container Registry
# -----------------------------------------------------------------------
output "acr_login_server" {
  description = "ACR login server URL. Use as the registry in GitHub Actions (e.g., <login_server>/winmovers-ops:latest)."
  value       = azurerm_container_registry.acr.login_server
}

output "acr_name" {
  description = "ACR name. Store this as the ACR_NAME GitHub Actions secret."
  value       = azurerm_container_registry.acr.name
}

# -----------------------------------------------------------------------
# Storage Account
# -----------------------------------------------------------------------
output "storage_account_name" {
  description = "Name of the Azure Storage Account."
  value       = azurerm_storage_account.storage.name
}

output "storage_container_name" {
  description = "Name of the blob container for file attachments."
  value       = azurerm_storage_container.attachments.name
}

output "storage_primary_connection_string" {
  description = "Primary connection string for the storage account. Set this as AZURE_STORAGE_CONNECTION_STRING in your App Service or .env file."
  value       = azurerm_storage_account.storage.primary_connection_string
  sensitive   = true
}

# -----------------------------------------------------------------------
# PostgreSQL Flexible Server
# -----------------------------------------------------------------------
output "postgres_fqdn" {
  description = "Fully qualified domain name of the PostgreSQL Flexible Server."
  value       = azurerm_postgresql_flexible_server.db.fqdn
}

output "postgres_database_url" {
  description = "DATABASE_URL connection string for Prisma. Set this as the DATABASE_URL app setting."
  value       = "postgresql://${var.postgres_admin_login}:${var.postgres_admin_password}@${azurerm_postgresql_flexible_server.db.fqdn}:5432/${var.postgres_db_name}?sslmode=require"
  sensitive   = true
}

# -----------------------------------------------------------------------
# Application Insights
# -----------------------------------------------------------------------
output "app_insights_connection_string" {
  description = "Application Insights connection string (null if enable_app_insights = false)."
  value       = var.enable_app_insights ? azurerm_application_insights.ai[0].connection_string : null
  sensitive   = true
}

output "app_insights_instrumentation_key" {
  description = "Application Insights instrumentation key (null if enable_app_insights = false)."
  value       = var.enable_app_insights ? azurerm_application_insights.ai[0].instrumentation_key : null
  sensitive   = true
}

# -----------------------------------------------------------------------
# GitHub Actions secrets reference
# -----------------------------------------------------------------------
output "github_actions_secrets_summary" {
  description = "Summary of the GitHub Actions secrets to configure in your repository."
  value       = <<-EOT
    Configure the following secrets in your GitHub repository (Settings → Secrets → Actions):

      ACR_NAME        = ${azurerm_container_registry.acr.name}
      AZURE_APP_ID    = <service principal appId>
      AZURE_PASSWORD  = <service principal password>
      AZURE_TENANT    = <your Azure tenant ID>

    To create a service principal with the required permissions:
      az ad sp create-for-rbac \
        --name winmovers-cicd \
        --role Contributor \
        --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/${azurerm_resource_group.rg.name}
  EOT
}
