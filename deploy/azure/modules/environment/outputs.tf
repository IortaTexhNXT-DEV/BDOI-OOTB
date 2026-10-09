output "public_url" {
  description = "Address of the environment (APP_URL of the GitHub environment)."
  value       = local.public_url
}

output "front_door_endpoint_host" {
  description = "Front Door endpoint host: the target of the CNAME record of the custom domain."
  value       = azurerm_cdn_frontdoor_endpoint.web.host_name
}

output "custom_domain_validation_token" {
  description = "Value of the TXT record _dnsauth.<custom domain> that proves ownership for the managed certificate."
  value       = try(azurerm_cdn_frontdoor_custom_domain.web[0].validation_token, null)
}

output "github_variables" {
  description = "Variables of the GitHub environment used by azure-deploy.yml."
  value = {
    AZURE_CLIENT_ID       = azurerm_user_assigned_identity.github.client_id
    AZURE_TENANT_ID       = data.azurerm_client_config.current.tenant_id
    AZURE_SUBSCRIPTION_ID = data.azurerm_client_config.current.subscription_id
    AZURE_RESOURCE_GROUP  = azurerm_resource_group.env.name
    API_APP_NAME          = azurerm_container_app.api.name
    WEB_APP_NAME          = azurerm_container_app.web.name
    MIGRATE_JOB_NAME      = azurerm_container_app_job.migrate.name
    APP_URL               = local.public_url
  }
}

output "key_vault_name" {
  description = "Key Vault of the environment's secrets."
  value       = azurerm_key_vault.env.name
}

output "postgres_server_name" {
  description = "PostgreSQL server (point-in-time and geo restore)."
  value       = azurerm_postgresql_flexible_server.db.name
}

output "postgres_fqdn" {
  description = "Private address of the PostgreSQL server."
  value       = azurerm_postgresql_flexible_server.db.fqdn
}

output "uploads_storage_account" {
  description = "Storage account of the documents share."
  value       = azurerm_storage_account.uploads.name
}

output "sftp_host" {
  description = "SFTP host name for SAP and the banks (<account>.<user>@<host>)."
  value       = var.sftp_enabled ? "${azurerm_storage_account.sftp[0].name}.blob.core.windows.net" : null
}

output "log_analytics_workspace_id" {
  description = "Workspace with the container, database, Key Vault and Front Door logs."
  value       = azurerm_log_analytics_workspace.env.workspace_id
}
