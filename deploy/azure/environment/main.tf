# Root of one BrokerVerse environment. The same code serves dev, sit, uat and prod; only the tfvars differ:
#
#   terraform init -reconfigure -backend-config=environments/uat.backend.hcl
#   terraform plan  -var-file=environments/uat.tfvars -out uat.plan
#   terraform apply uat.plan

module "environment" {
  source = "../modules/environment"

  environment       = var.environment
  location          = var.location
  tags              = var.tags
  cost_center       = var.cost_center
  address_space     = var.address_space
  acr_id            = var.acr_id
  acr_login_server  = var.acr_login_server
  api_image         = var.api_image
  web_image         = var.web_image
  public_host_name  = var.public_host_name
  environment_label = var.environment_label

  postgres_sku                   = var.postgres_sku
  postgres_storage_mb            = var.postgres_storage_mb
  postgres_backup_retention_days = var.postgres_backup_retention_days
  postgres_high_availability     = var.postgres_high_availability
  postgres_geo_redundant_backup  = var.postgres_geo_redundant_backup

  zone_redundant = var.zone_redundant
  api            = var.api
  web            = var.web
  trust_proxy    = var.trust_proxy

  uploads_replication = var.uploads_replication
  uploads_quota_gb    = var.uploads_quota_gb
  uploads_backup      = var.uploads_backup

  smtp_enabled     = var.smtp_enabled
  entra_sign_in    = var.entra_sign_in
  sftp_enabled     = var.sftp_enabled
  sftp_users       = var.sftp_users
  sftp_allowed_ips = var.sftp_allowed_ips

  waf_mode                      = var.waf_mode
  sign_in_rate_limit_per_minute = var.sign_in_rate_limit_per_minute
  key_vault_admins              = var.key_vault_admins
  operator_ips                  = var.operator_ips

  github_repository      = var.github_repository
  github_environment     = var.github_environment
  github_can_push_images = var.github_can_push_images

  alert_emails       = var.alert_emails
  log_retention_days = var.log_retention_days
}
