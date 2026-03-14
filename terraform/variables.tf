# -----------------------------------------------------------------------
# General
# -----------------------------------------------------------------------
variable "location" {
  description = "Azure region where all resources will be created."
  type        = string
  default     = "centralus"
}

variable "resource_group_name" {
  description = "Name of the Azure Resource Group."
  type        = string
  default     = "winmovers-rg"
}

# -----------------------------------------------------------------------
# Azure Container Registry (ACR)
# -----------------------------------------------------------------------
variable "acr_name" {
  description = "Globally unique name for the Azure Container Registry (lowercase, 5-50 chars, alphanumeric only)."
  type        = string
}

variable "acr_sku" {
  description = "SKU for the Azure Container Registry. Valid values: Basic, Standard, Premium."
  type        = string
  default     = "Basic"

  validation {
    condition     = contains(["Basic", "Standard", "Premium"], var.acr_sku)
    error_message = "acr_sku must be one of: Basic, Standard, Premium."
  }
}

# -----------------------------------------------------------------------
# App Service Plan
# -----------------------------------------------------------------------
variable "app_service_plan_name" {
  description = "Name of the App Service Plan."
  type        = string
  default     = "winmovers-rg-plan"
}

variable "app_service_plan_sku" {
  description = "SKU name for the App Service Plan (e.g., B1, B2, S1, P1v3)."
  type        = string
  default     = "B1"
}

# -----------------------------------------------------------------------
# App Service (Web App for Containers)
# -----------------------------------------------------------------------
variable "app_name" {
  description = "Name of the Azure App Service. Must be globally unique (used as <app_name>.azurewebsites.net)."
  type        = string
  default     = "winmovers-ops-2026"
}

variable "docker_image_name" {
  description = "Docker image name and tag to use on initial deploy (e.g., winmovers-ops:latest)."
  type        = string
  default     = "winmovers-ops:latest"
}

# -----------------------------------------------------------------------
# Storage Account
# -----------------------------------------------------------------------
variable "storage_account_name" {
  description = "Globally unique name for the Azure Storage Account (3-24 lowercase alphanumeric chars)."
  type        = string
}

variable "storage_container_name" {
  description = "Name of the blob container for file attachments."
  type        = string
  default     = "job-files"
}

# -----------------------------------------------------------------------
# PostgreSQL Flexible Server
# -----------------------------------------------------------------------
variable "postgres_server_name" {
  description = "Globally unique name for the PostgreSQL Flexible Server."
  type        = string
}

variable "postgres_admin_login" {
  description = "Administrator login name for the PostgreSQL server."
  type        = string
  sensitive   = true
}

variable "postgres_admin_password" {
  description = "Administrator password for the PostgreSQL server (min 8 chars, must include uppercase, lowercase, digit, and special character)."
  type        = string
  sensitive   = true
}

variable "postgres_db_name" {
  description = "Name of the initial PostgreSQL database."
  type        = string
  default     = "winmovers"
}

variable "postgres_sku_name" {
  description = "SKU name for the PostgreSQL Flexible Server (e.g., B_Standard_B1ms for burstable)."
  type        = string
  default     = "B_Standard_B1ms"
}

variable "postgres_storage_mb" {
  description = "Storage size in MB for the PostgreSQL Flexible Server (min 32768)."
  type        = number
  default     = 32768
}

variable "postgres_version" {
  description = "PostgreSQL engine major version."
  type        = string
  default     = "16"
}

variable "postgres_zone" {
  description = "Availability zone for the PostgreSQL Flexible Server (\"1\", \"2\", or \"3\"). Check which zones are available in your region."
  type        = string
  default     = "1"
}

variable "postgres_public_network_access" {
  description = "Allow public network access to the PostgreSQL server. When true, a firewall rule is added to allow all Azure service IPs (0.0.0.0). Set to false if you configure VNet integration instead."
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------
# Application Insights / Log Analytics
# -----------------------------------------------------------------------
variable "enable_app_insights" {
  description = "Whether to create Application Insights and Log Analytics workspace."
  type        = bool
  default     = true
}

variable "log_analytics_workspace_name" {
  description = "Name of the Log Analytics workspace used by Application Insights."
  type        = string
  default     = "winmovers-logs"
}

variable "log_analytics_retention_days" {
  description = "Number of days to retain data in the Log Analytics workspace (30–730)."
  type        = number
  default     = 30

  validation {
    condition     = var.log_analytics_retention_days >= 30 && var.log_analytics_retention_days <= 730
    error_message = "log_analytics_retention_days must be between 30 and 730."
  }
}

variable "app_insights_name" {
  description = "Name of the Application Insights resource."
  type        = string
  default     = "winmovers-ops-ai"
}
