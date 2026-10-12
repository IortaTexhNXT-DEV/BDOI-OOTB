# Long-term database backup export (NFR-11: database backups retained for a minimum of 10 years).
#
# The PostgreSQL point-in-time backups (database.tf) cover at most 35 days. For the 10-year retention a scheduled
# Container Apps job takes a full logical export of the database (pg_dump, custom format, compressed) once a month and
# writes it to a dedicated storage account:
#   - container db-archive, private, reached through a private endpoint; the job writes with the app identity
#     (Storage Blob Data Contributor on the container only)
#   - time-based immutability on the container (WORM): an export cannot be changed or deleted for
#     db_archive_retention_years; lock the policy (db_archive_lock_immutability) once TISPH accepts the set-up, after
#     which nobody, Terraform included, can shorten it
#   - lifecycle: an export moves to the Archive access tier the day after it is written and is deleted only after the
#     retention period (plus 30 days)
#   - geo-redundant storage in production (the paired region keeps a copy)
# Restoring an export: deploy/AZURE.md section 12. Nothing here is provisioned until db_archive_export
# is switched on for an environment (prod.tfvars).

locals {
  db_archive           = var.db_archive_export ? 1 : 0
  db_archive_days      = var.db_archive_retention_years * 366
  db_archive_container = "db-archive"
}

resource "azurerm_storage_account" "archive" {
  count                           = local.db_archive
  name                            = "st${local.short}ar${random_string.suffix.result}"
  resource_group_name             = azurerm_resource_group.env.name
  location                        = azurerm_resource_group.env.location
  account_kind                    = "StorageV2"
  account_tier                    = "Standard"
  account_replication_type        = local.prod ? "GRS" : "LRS"
  access_tier                     = "Cool"
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true
  tags                            = merge(local.tags, { purpose = "database-backup-archive" })

  network_rules {
    default_action = "Deny"
    bypass         = ["AzureServices"]
    ip_rules       = var.operator_ips
  }

  blob_properties {
    versioning_enabled = true
    delete_retention_policy {
      days = 30
    }
    container_delete_retention_policy {
      days = 30
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_storage_container" "db_archive" {
  count                 = local.db_archive
  name                  = local.db_archive_container
  storage_account_id    = azurerm_storage_account.archive[0].id
  container_access_type = "private"
}

# WORM: every export is kept unchanged for the retention period
resource "azurerm_storage_container_immutability_policy" "db_archive" {
  count                                 = local.db_archive
  storage_container_resource_manager_id = azurerm_storage_container.db_archive[0].id
  immutability_period_in_days           = local.db_archive_days
  protected_append_writes_enabled       = false
  locked                                = var.db_archive_lock_immutability
}

resource "azurerm_storage_management_policy" "archive" {
  count              = local.db_archive
  storage_account_id = azurerm_storage_account.archive[0].id

  rule {
    name    = "db-exports-to-archive"
    enabled = true
    filters {
      prefix_match = ["${local.db_archive_container}/"]
      blob_types   = ["blockBlob"]
    }
    actions {
      base_blob {
        tier_to_archive_after_days_since_creation_greater_than = 1
        delete_after_days_since_creation_greater_than          = local.db_archive_days + 30
      }
      version {
        delete_after_days_since_creation = local.db_archive_days + 30
      }
    }
  }
}

resource "azurerm_private_endpoint" "archive" {
  count               = local.db_archive
  name                = "pe-${local.name}-archive"
  resource_group_name = azurerm_resource_group.env.name
  location            = azurerm_resource_group.env.location
  subnet_id           = azurerm_subnet.endpoints.id
  tags                = local.tags

  private_service_connection {
    name                           = "blob"
    private_connection_resource_id = azurerm_storage_account.archive[0].id
    subresource_names              = ["blob"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "blob"
    private_dns_zone_ids = [azurerm_private_dns_zone.zone["blob"].id]
  }
}

resource "azurerm_role_assignment" "app_db_archive" {
  count                = local.db_archive
  scope                = azurerm_storage_container.db_archive[0].id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}

# Monthly export: pg_dump of the application database, uploaded with the app identity (managed identity token, Blob
# REST API). The job execution fails (Container Apps job history, Log Analytics) when either step fails.
resource "azurerm_container_app_job" "db_archive" {
  count                        = local.db_archive
  name                         = "caj-${local.name}-dbarchive"
  resource_group_name          = azurerm_resource_group.env.name
  location                     = azurerm_resource_group.env.location
  container_app_environment_id = azurerm_container_app_environment.env.id
  workload_profile_name        = "Consumption"
  replica_timeout_in_seconds   = 7200
  replica_retry_limit          = 1
  tags                         = local.tags

  schedule_trigger_config {
    cron_expression          = var.db_archive_schedule
    parallelism              = 1
    replica_completion_count = 1
  }

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }

  secret {
    name                = "database-url"
    key_vault_secret_id = local.kv_secret["database-url"]
    identity            = azurerm_user_assigned_identity.app.id
  }

  template {
    container {
      name   = "db-archive"
      image  = var.db_archive_image
      cpu    = 1
      memory = "2Gi"
      command = ["sh", "-c", <<-EOT
        set -eu
        apk add --no-cache curl >/dev/null
        FILE="brokerverse-$(date -u +%Y%m%dT%H%M%SZ).dump"
        pg_dump --format=custom --compress=9 --no-owner --no-privileges --dbname="$DATABASE_URL" --file="/tmp/$FILE"
        TOKEN=$(curl -sf -H "X-IDENTITY-HEADER: $IDENTITY_HEADER" "$IDENTITY_ENDPOINT?api-version=2019-08-01&resource=https://storage.azure.com/&client_id=$AZURE_CLIENT_ID" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
        curl -sf -X PUT -H "Authorization: Bearer $TOKEN" -H "x-ms-version: 2023-11-03" -H "x-ms-blob-type: BlockBlob" \
          -H "Content-Type: application/octet-stream" --upload-file "/tmp/$FILE" "$ARCHIVE_URL/$FILE"
        echo "Exported $FILE ($(wc -c < "/tmp/$FILE") bytes) to $ARCHIVE_URL"
      EOT
      ]

      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }
      env {
        name  = "AZURE_CLIENT_ID"
        value = azurerm_user_assigned_identity.app.client_id
      }
      env {
        name  = "ARCHIVE_URL"
        value = "${azurerm_storage_account.archive[0].primary_blob_endpoint}${local.db_archive_container}"
      }
    }
  }

  depends_on = [azurerm_role_assignment.app_db_archive, azurerm_private_endpoint.archive, azurerm_role_assignment.kv_app]
}
