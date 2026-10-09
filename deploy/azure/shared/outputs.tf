output "acr_id" {
  description = "Registry resource ID (acr_id in the environment tfvars)."
  value       = azurerm_container_registry.acr.id
}

output "acr_login_server" {
  description = "Registry login server (acr_login_server in the environment tfvars, ACR_LOGIN_SERVER in GitHub)."
  value       = azurerm_container_registry.acr.login_server
}
