# SFTP endpoint for the file interfaces (NFR-09): the daily SAP text files (INTG-04) and the bank statement and
# payment files. Azure Storage SFTP on a hierarchical-namespace account, one container per direction, SSH-key local
# users. The public endpoint admits only the partners' addresses (sftp_allowed_ips); the API reaches the account
# through a private endpoint with its managed identity (Storage Blob Data Contributor).

locals {
  sftp_containers = var.sftp_enabled ? toset(["sap-outbound", "bank-inbound", "bank-outbound"]) : toset([])
}

resource "azurerm_storage_account" "sftp" {
  count                           = var.sftp_enabled ? 1 : 0
  name                            = "st${local.short}ft${random_string.suffix.result}"
  resource_group_name             = azurerm_resource_group.env.name
  location                        = azurerm_resource_group.env.location
  account_kind                    = "StorageV2"
  account_tier                    = "Standard"
  account_replication_type        = local.prod ? "ZRS" : "LRS"
  is_hns_enabled                  = true
  sftp_enabled                    = true
  local_user_enabled              = true
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  allow_nested_items_to_be_public = false
  default_to_oauth_authentication = true
  tags                            = local.tags

  network_rules {
    default_action = "Deny"
    bypass         = ["AzureServices"]
    ip_rules       = concat(var.sftp_allowed_ips, var.operator_ips)
  }

  blob_properties {
    delete_retention_policy {
      days = 30
    }
    container_delete_retention_policy {
      days = 30
    }
  }
}

resource "azurerm_storage_container" "sftp" {
  for_each              = local.sftp_containers
  name                  = each.value
  storage_account_id    = azurerm_storage_account.sftp[0].id
  container_access_type = "private"
}

resource "azurerm_storage_account_local_user" "sftp" {
  for_each             = var.sftp_enabled ? var.sftp_users : {}
  name                 = each.key
  storage_account_id   = azurerm_storage_account.sftp[0].id
  ssh_key_enabled      = true
  ssh_password_enabled = false
  home_directory       = each.value.container

  ssh_authorized_key {
    description = each.key
    key         = each.value.ssh_public_key
  }

  permission_scope {
    service       = "blob"
    resource_name = each.value.container
    permissions {
      read   = true
      list   = true
      create = each.value.write
      write  = each.value.write
      delete = each.value.write
    }
  }

  depends_on = [azurerm_storage_container.sftp]
}

resource "azurerm_private_endpoint" "sftp" {
  count               = var.sftp_enabled ? 1 : 0
  name                = "pe-${local.name}-sftp"
  resource_group_name = azurerm_resource_group.env.name
  location            = azurerm_resource_group.env.location
  subnet_id           = azurerm_subnet.endpoints.id
  tags                = local.tags

  private_service_connection {
    name                           = "blob"
    private_connection_resource_id = azurerm_storage_account.sftp[0].id
    subresource_names              = ["blob"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "blob"
    private_dns_zone_ids = [azurerm_private_dns_zone.zone["blob"].id]
  }
}

resource "azurerm_role_assignment" "sftp_app" {
  count                = var.sftp_enabled ? 1 : 0
  scope                = azurerm_storage_account.sftp[0].id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}
