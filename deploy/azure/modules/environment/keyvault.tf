# Key Vault: every secret of the environment. The containers read them through their managed identity (Container Apps
# Key Vault references); nobody copies a secret into a variable.
#
# Generated here, once (later rotation is done in Key Vault and Terraform leaves the value alone): jwt-secret,
# data-encryption-key, pii-encryption-key, admin-password. Generated and kept in step with the server:
# postgres-password and database-url. Created by an operator: smtp-url and entra-client-secret (deploy/AZURE.md).

resource "azurerm_key_vault" "env" {
  name                          = "kv-${local.short}-${random_string.suffix.result}"
  resource_group_name           = azurerm_resource_group.env.name
  location                      = azurerm_resource_group.env.location
  tenant_id                     = data.azurerm_client_config.current.tenant_id
  sku_name                      = "standard"
  rbac_authorization_enabled    = true
  purge_protection_enabled      = local.prod
  soft_delete_retention_days    = 90
  public_network_access_enabled = true
  tags                          = local.tags

  network_acls {
    default_action = "Deny"
    bypass         = "AzureServices"
    ip_rules       = var.operator_ips
  }
}

resource "azurerm_private_endpoint" "key_vault" {
  name                = "pe-${local.name}-kv"
  resource_group_name = azurerm_resource_group.env.name
  location            = azurerm_resource_group.env.location
  subnet_id           = azurerm_subnet.endpoints.id
  tags                = local.tags

  private_service_connection {
    name                           = "kv"
    private_connection_resource_id = azurerm_key_vault.env.id
    subresource_names              = ["vault"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "vault"
    private_dns_zone_ids = [azurerm_private_dns_zone.zone["vault"].id]
  }
}

resource "azurerm_role_assignment" "kv_terraform" {
  scope                = azurerm_key_vault.env.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.current.object_id
}

resource "azurerm_role_assignment" "kv_admins" {
  for_each             = toset(var.key_vault_admins)
  scope                = azurerm_key_vault.env.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = each.value
}

resource "azurerm_role_assignment" "kv_app" {
  scope                = azurerm_key_vault.env.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}

resource "random_password" "app_key" {
  for_each = toset(["jwt-secret", "data-encryption-key", "pii-encryption-key"])
  length   = 64
  special  = false
}

# satisfies the default password policy (upper, lower, digit, symbol); changed at the first sign-in
resource "random_password" "admin" {
  length           = 24
  min_upper        = 2
  min_lower        = 2
  min_numeric      = 2
  min_special      = 2
  override_special = "#%+-=@_"
}

resource "random_password" "postgres" {
  length  = 40
  special = false
}

resource "azurerm_key_vault_secret" "generated" {
  for_each = {
    "jwt-secret"          = random_password.app_key["jwt-secret"].result
    "data-encryption-key" = random_password.app_key["data-encryption-key"].result
    "pii-encryption-key"  = random_password.app_key["pii-encryption-key"].result
    "admin-password"      = random_password.admin.result
  }
  name         = each.key
  value        = each.value
  key_vault_id = azurerm_key_vault.env.id
  content_type = "text/plain"
  tags         = local.tags

  depends_on = [azurerm_role_assignment.kv_terraform]

  lifecycle {
    ignore_changes = [value, tags]
  }
}

resource "azurerm_key_vault_secret" "postgres_password" {
  name         = "postgres-password"
  value        = random_password.postgres.result
  key_vault_id = azurerm_key_vault.env.id
  content_type = "text/plain"
  tags         = local.tags
  depends_on   = [azurerm_role_assignment.kv_terraform]
}

# Manila time on every connection (reports, cut-off times and scheduled jobs use the database's date) and TLS with
# the server certificate checked.
resource "azurerm_key_vault_secret" "database_url" {
  name         = "database-url"
  value        = "postgres://${azurerm_postgresql_flexible_server.db.administrator_login}:${urlencode(random_password.postgres.result)}@${azurerm_postgresql_flexible_server.db.fqdn}:5432/${azurerm_postgresql_flexible_server_database.app.name}?sslmode=verify-full&options=-c%20TimeZone%3DAsia%2FManila"
  key_vault_id = azurerm_key_vault.env.id
  content_type = "text/uri"
  tags         = local.tags
  depends_on   = [azurerm_role_assignment.kv_terraform]
}

locals {
  # versionless secret addresses: a new version in Key Vault reaches the containers on their next revision or restart
  kv_secret = { for name in ["database-url", "jwt-secret", "data-encryption-key", "pii-encryption-key", "admin-password", "smtp-url", "entra-client-secret"] : name => "${azurerm_key_vault.env.vault_uri}secrets/${name}" }
}
