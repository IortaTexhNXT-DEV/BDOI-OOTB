# PostgreSQL 16 Flexible Server, private access only (delegated subnet). Continuous backups give point-in-time restore
# to any second of the retention window; production adds a zone-redundant standby (automatic failover) and backups
# copied to the paired region (geo-restore), which together meet RPO 1 hour / RTO 4 hours (NFR-06.2, NFR-06.3).

resource "azurerm_postgresql_flexible_server" "db" {
  name                          = "psql-${local.name}-${random_string.suffix.result}"
  resource_group_name           = azurerm_resource_group.env.name
  location                      = azurerm_resource_group.env.location
  version                       = "16"
  sku_name                      = var.postgres_sku
  storage_mb                    = var.postgres_storage_mb
  auto_grow_enabled             = true
  backup_retention_days         = var.postgres_backup_retention_days
  geo_redundant_backup_enabled  = var.postgres_geo_redundant_backup
  delegated_subnet_id           = azurerm_subnet.database.id
  private_dns_zone_id           = azurerm_private_dns_zone.zone["postgres"].id
  public_network_access_enabled = false
  administrator_login           = "bvadmin"
  administrator_password        = random_password.postgres.result
  zone                          = "1"
  tags                          = local.tags

  authentication {
    password_auth_enabled         = true
    active_directory_auth_enabled = false
  }

  dynamic "high_availability" {
    for_each = var.postgres_high_availability ? [1] : []
    content {
      mode                      = "ZoneRedundant"
      standby_availability_zone = "2"
    }
  }

  # Sunday 02:00 Manila time (Saturday 18:00 UTC)
  maintenance_window {
    day_of_week  = 6
    start_hour   = 18
    start_minute = 0
  }

  depends_on = [azurerm_private_dns_zone_virtual_network_link.zone]

  lifecycle {
    # after a failover the primary and standby zones are swapped; Terraform must not swap them back
    ignore_changes = [zone, high_availability[0].standby_availability_zone]
  }
}

resource "azurerm_postgresql_flexible_server_database" "app" {
  name      = "brokerverse"
  server_id = azurerm_postgresql_flexible_server.db.id
  charset   = "UTF8"
  collation = "en_US.utf8"

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_postgresql_flexible_server_configuration" "settings" {
  for_each = {
    "timezone"                   = "Asia/Manila"
    "azure.extensions"           = "PGCRYPTO"
    "require_secure_transport"   = "on"
    "log_min_duration_statement" = "2000"
  }
  name      = each.key
  server_id = azurerm_postgresql_flexible_server.db.id
  value     = each.value
}
