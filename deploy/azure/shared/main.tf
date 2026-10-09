# Resources shared by every BrokerVerse environment: the container registry. Images are built once (on the dev
# deployment) and the same digest is promoted to SIT, UAT and production (.github/workflows/azure-deploy.yml).

locals {
  tags = merge({
    application = "BrokerVerse"
    owner       = "TISPH IT"
    environment = "shared"
    managed-by  = "terraform"
  }, var.tags)
}

resource "random_string" "suffix" {
  length  = 5
  upper   = false
  special = false
}

resource "azurerm_resource_group" "shared" {
  name     = "rg-tisph-bv-shared"
  location = var.location
  tags     = local.tags
}

resource "azurerm_container_registry" "acr" {
  name                          = "acrtisphbv${random_string.suffix.result}"
  resource_group_name           = azurerm_resource_group.shared.name
  location                      = azurerm_resource_group.shared.location
  sku                           = "Premium"
  admin_enabled                 = false
  anonymous_pull_enabled        = false
  public_network_access_enabled = true
  zone_redundancy_enabled       = true
  retention_policy_in_days      = var.untagged_retention_days
  tags                          = local.tags

  dynamic "georeplications" {
    for_each = var.replica_location == "" ? [] : [var.replica_location]
    content {
      location                = georeplications.value
      zone_redundancy_enabled = false
      tags                    = local.tags
    }
  }
}

resource "azurerm_management_lock" "acr" {
  name       = "keep-registry"
  scope      = azurerm_container_registry.acr.id
  lock_level = "CanNotDelete"
  notes      = "Images running in every BrokerVerse environment."
}
