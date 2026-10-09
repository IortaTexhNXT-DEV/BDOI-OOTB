# One BrokerVerse environment (dev, sit, uat or prod) on Azure: network, PostgreSQL, documents share, Key Vault,
# Container Apps (api, web, migration job), Front Door with WAF, monitoring and the pipeline's identity.
# Runbook: deploy/AZURE.md.

data "azurerm_client_config" "current" {}

locals {
  name  = "tisph-bv-${var.environment}"
  short = "tisphbv${var.environment}"
  prod  = var.environment == "prod"

  tags = merge({
    application = "BrokerVerse"
    environment = var.environment
    owner       = "TISPH IT"
    cost-center = var.cost_center
    managed-by  = "terraform"
  }, var.tags)

  # the address users open: the custom domain, else the Front Door endpoint
  public_host = var.public_host_name != "" ? var.public_host_name : azurerm_cdn_frontdoor_endpoint.web.host_name
  public_url  = "https://${local.public_host}"
}

# keeps globally unique names (storage, Key Vault, PostgreSQL) stable for the life of the environment
resource "random_string" "suffix" {
  length  = 5
  upper   = false
  special = false
}

resource "azurerm_resource_group" "env" {
  name     = "rg-${local.name}"
  location = var.location
  tags     = local.tags
}

resource "azurerm_management_lock" "database" {
  count      = local.prod ? 1 : 0
  name       = "keep-production-database"
  scope      = azurerm_postgresql_flexible_server.db.id
  lock_level = "CanNotDelete"
  notes      = "Production data. Remove the lock only for a planned decommissioning."
}

# Identity of the running containers: pulls images and reads the Key Vault secrets.
resource "azurerm_user_assigned_identity" "app" {
  name                = "id-${local.name}-app"
  resource_group_name = azurerm_resource_group.env.name
  location            = azurerm_resource_group.env.location
  tags                = local.tags
}

resource "azurerm_role_assignment" "app_acr_pull" {
  scope                = var.acr_id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}
