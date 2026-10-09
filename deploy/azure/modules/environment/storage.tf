# Documents, photos and generated reports (UPLOAD_DIR) on an Azure Files share mounted at /app/uploads in the API and
# the migration job. Shared by every API replica. Reached through a private endpoint; the public endpoint only
# admits the operators' addresses and Azure Backup.

resource "azurerm_storage_account" "uploads" {
  name                            = "st${local.short}up${random_string.suffix.result}"
  resource_group_name             = azurerm_resource_group.env.name
  location                        = azurerm_resource_group.env.location
  account_kind                    = "StorageV2"
  account_tier                    = "Standard"
  account_replication_type        = var.uploads_replication
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  allow_nested_items_to_be_public = false
  # Container Apps mounts Azure Files (SMB) with the account key
  shared_access_key_enabled = true
  tags                      = local.tags

  network_rules {
    default_action = "Deny"
    bypass         = ["AzureServices"]
    ip_rules       = var.operator_ips
  }

  share_properties {
    retention_policy {
      days = 30
    }
  }
}

resource "azurerm_storage_share" "uploads" {
  name               = "uploads"
  storage_account_id = azurerm_storage_account.uploads.id
  quota              = var.uploads_quota_gb
  access_tier        = "TransactionOptimized"

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_private_endpoint" "uploads" {
  name                = "pe-${local.name}-files"
  resource_group_name = azurerm_resource_group.env.name
  location            = azurerm_resource_group.env.location
  subnet_id           = azurerm_subnet.endpoints.id
  tags                = local.tags

  private_service_connection {
    name                           = "files"
    private_connection_resource_id = azurerm_storage_account.uploads.id
    subresource_names              = ["file"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "file"
    private_dns_zone_ids = [azurerm_private_dns_zone.zone["file"].id]
  }
}

# ------------------------------------------------------------------------------------------- backup of the share
resource "azurerm_recovery_services_vault" "env" {
  count               = var.uploads_backup ? 1 : 0
  name                = "rsv-${local.name}"
  resource_group_name = azurerm_resource_group.env.name
  location            = azurerm_resource_group.env.location
  sku                 = "Standard"
  storage_mode_type   = local.prod ? "GeoRedundant" : "LocallyRedundant"
  tags                = local.tags
}

resource "azurerm_backup_policy_file_share" "uploads" {
  count               = var.uploads_backup ? 1 : 0
  name                = "uploads-every-4h"
  resource_group_name = azurerm_resource_group.env.name
  recovery_vault_name = azurerm_recovery_services_vault.env[0].name
  timezone            = "Singapore Standard Time"

  backup {
    frequency = "Hourly"
    hourly {
      interval        = 4
      start_time      = "00:00"
      window_duration = 24
    }
  }

  retention_daily {
    count = 30
  }

  dynamic "retention_weekly" {
    for_each = local.prod ? [1] : []
    content {
      count    = 12
      weekdays = ["Sunday"]
    }
  }

  dynamic "retention_monthly" {
    for_each = local.prod ? [1] : []
    content {
      count    = 12
      weekdays = ["Sunday"]
      weeks    = ["First"]
    }
  }
}

resource "azurerm_backup_container_storage_account" "uploads" {
  count               = var.uploads_backup ? 1 : 0
  resource_group_name = azurerm_resource_group.env.name
  recovery_vault_name = azurerm_recovery_services_vault.env[0].name
  storage_account_id  = azurerm_storage_account.uploads.id
}

resource "azurerm_backup_protected_file_share" "uploads" {
  count                     = var.uploads_backup ? 1 : 0
  resource_group_name       = azurerm_resource_group.env.name
  recovery_vault_name       = azurerm_recovery_services_vault.env[0].name
  source_storage_account_id = azurerm_backup_container_storage_account.uploads[0].storage_account_id
  source_file_share_name    = azurerm_storage_share.uploads.name
  backup_policy_id          = azurerm_backup_policy_file_share.uploads[0].id
}
