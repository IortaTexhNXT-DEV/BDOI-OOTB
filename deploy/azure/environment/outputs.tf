output "public_url" {
  description = "Address of the environment."
  value       = module.environment.public_url
}

output "front_door_endpoint_host" {
  description = "Target of the custom domain's CNAME record."
  value       = module.environment.front_door_endpoint_host
}

output "custom_domain_validation_token" {
  description = "TXT record _dnsauth.<custom domain>."
  value       = module.environment.custom_domain_validation_token
}

output "github_variables" {
  description = "Variables of the GitHub environment."
  value       = module.environment.github_variables
}

output "key_vault_name" {
  description = "Key Vault of the environment."
  value       = module.environment.key_vault_name
}

output "postgres_server_name" {
  description = "PostgreSQL server."
  value       = module.environment.postgres_server_name
}

output "postgres_fqdn" {
  description = "Private address of the PostgreSQL server."
  value       = module.environment.postgres_fqdn
}

output "uploads_storage_account" {
  description = "Storage account of the documents share."
  value       = module.environment.uploads_storage_account
}

output "sftp_host" {
  description = "SFTP host name."
  value       = module.environment.sftp_host
}

output "log_analytics_workspace_id" {
  description = "Log Analytics workspace ID."
  value       = module.environment.log_analytics_workspace_id
}
