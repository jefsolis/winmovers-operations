# =======================================================================
# WinMovers Operations — Azure Infrastructure
# =======================================================================
# Resources created:
#   - Resource Group
#   - Azure Container Registry (ACR)
#   - App Service Plan (Linux)
#   - App Service / Web App for Containers
#     - System-assigned managed identity
#     - AcrPull role assignment so the app can pull from ACR without credentials
#   - Azure Storage Account + Blob Container (for file attachments)
#   - Azure Database for PostgreSQL Flexible Server
#   - Log Analytics Workspace + Application Insights (optional)
# =======================================================================

# -----------------------------------------------------------------------
# Resource Group
# -----------------------------------------------------------------------
resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location
}

# -----------------------------------------------------------------------
# Azure Container Registry
# -----------------------------------------------------------------------
resource "azurerm_container_registry" "acr" {
  name                = var.acr_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = var.acr_sku
  admin_enabled       = false # managed identity is used instead of admin creds
}

# -----------------------------------------------------------------------
# App Service Plan (Linux)
# -----------------------------------------------------------------------
resource "azurerm_service_plan" "plan" {
  name                = var.app_service_plan_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  os_type             = "Linux"
  sku_name            = var.app_service_plan_sku
}

# -----------------------------------------------------------------------
# App Service — Web App for Containers
# -----------------------------------------------------------------------
resource "azurerm_linux_web_app" "app" {
  name                = var.app_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  service_plan_id     = azurerm_service_plan.plan.id

  # System-assigned managed identity (used for AcrPull below)
  identity {
    type = "SystemAssigned"
  }

  site_config {
    # Use the managed identity to authenticate to ACR (no credentials stored)
    container_registry_use_managed_identity = true

    application_stack {
      docker_image_name   = var.docker_image_name
      docker_registry_url = "https://${azurerm_container_registry.acr.login_server}"
    }

    # Always-on is not available on B1, so set to false
    always_on = false
  }

  # Application settings wired to the other resources created in this module
  app_settings = merge(
    {
      "PORT"                            = "8080"
      "WEBSITES_PORT"                   = "8080"
      "DATABASE_URL"                    = "postgresql://${var.postgres_admin_login}:${var.postgres_admin_password}@${azurerm_postgresql_flexible_server.db.fqdn}:5432/${var.postgres_db_name}?sslmode=require"
      "AZURE_STORAGE_CONNECTION_STRING" = azurerm_storage_account.storage.primary_connection_string
      "AZURE_STORAGE_CONTAINER"         = var.storage_container_name
    },
    var.enable_app_insights ? {
      "APPINSIGHTS_INSTRUMENTATIONKEY"        = azurerm_application_insights.ai[0].instrumentation_key
      "APPLICATIONINSIGHTS_CONNECTION_STRING" = azurerm_application_insights.ai[0].connection_string
    } : {}
  )

  # Avoid replacing the web app when app settings change during CI/CD deployments
  lifecycle {
    ignore_changes = [
      site_config[0].application_stack[0].docker_image_name,
    ]
  }
}

# Grant the App Service managed identity permission to pull images from ACR
resource "azurerm_role_assignment" "acr_pull" {
  scope                = azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_linux_web_app.app.identity[0].principal_id
}

# -----------------------------------------------------------------------
# Storage Account + Blob Container (file attachments)
# -----------------------------------------------------------------------
resource "azurerm_storage_account" "storage" {
  name                     = var.storage_account_name
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  blob_properties {
    delete_retention_policy {
      days = 7
    }
  }
}

resource "azurerm_storage_container" "attachments" {
  name                  = var.storage_container_name
  storage_account_name  = azurerm_storage_account.storage.name
  container_access_type = "private"
}

# -----------------------------------------------------------------------
# Azure Database for PostgreSQL Flexible Server
# -----------------------------------------------------------------------
resource "azurerm_postgresql_flexible_server" "db" {
  name                   = var.postgres_server_name
  resource_group_name    = azurerm_resource_group.rg.name
  location               = azurerm_resource_group.rg.location
  version                = var.postgres_version
  administrator_login    = var.postgres_admin_login
  administrator_password = var.postgres_admin_password
  sku_name               = var.postgres_sku_name
  storage_mb             = var.postgres_storage_mb
  zone                   = var.postgres_zone

  backup_retention_days        = 7
  geo_redundant_backup_enabled = false
}

resource "azurerm_postgresql_flexible_server_database" "winmovers_db" {
  name      = var.postgres_db_name
  server_id = azurerm_postgresql_flexible_server.db.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# Allow outbound traffic from Azure services (including App Service) to reach PostgreSQL.
# NOTE: This allows all Azure IPs (including other tenants). For higher security,
# disable this and use VNet integration (set postgres_public_network_access = false).
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure_services" {
  count            = var.postgres_public_network_access ? 1 : 0
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.db.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# -----------------------------------------------------------------------
# Log Analytics Workspace + Application Insights (optional)
# -----------------------------------------------------------------------
resource "azurerm_log_analytics_workspace" "logs" {
  count               = var.enable_app_insights ? 1 : 0
  name                = var.log_analytics_workspace_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "PerGB2018"
  retention_in_days   = var.log_analytics_retention_days
}

resource "azurerm_application_insights" "ai" {
  count               = var.enable_app_insights ? 1 : 0
  name                = var.app_insights_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  workspace_id        = azurerm_log_analytics_workspace.logs[0].id
  application_type    = "web"
}
