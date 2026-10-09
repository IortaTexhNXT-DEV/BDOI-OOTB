# BrokerVerse PROD on Azure. Values marked TISPH come from TISPH IT; the rest are the sizing agreed for PROD.
# No secret belongs here: secrets live in the environment's Key Vault (deploy/AZURE.md, section 5).

subscription_id = "00000000-0000-0000-0000-000000000000" # TISPH: subscription of the BrokerVerse environments
environment     = "prod"
location        = "southeastasia"
address_space   = "10.43.0.0/16"
cost_center     = "" # TISPH

# shared registry (outputs of deploy/azure/shared); the images of the first deployment, later set by the pipeline
acr_id           = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-tisph-bv-shared/providers/Microsoft.ContainerRegistry/registries/acrtisphbvxxxxx"
acr_login_server = "acrtisphbvxxxxx.azurecr.io"
api_image        = "acrtisphbvxxxxx.azurecr.io/brokerverse-api:bootstrap"
web_image        = "acrtisphbvxxxxx.azurecr.io/brokerverse-web:bootstrap"

# TISPH: e.g. "brokerverse.<tisph domain>" (CNAME to the Front Door endpoint); empty = the *.azurefd.net address
public_host_name  = ""
environment_label = ""

# 99.9% (NFR-15), RPO 1 hour / RTO 4 hours (NFR-06.2, NFR-06.3): zone-redundant standby, 35 days of point-in-time
# restore, backups copied to the paired region, at least two replicas in a zone-redundant environment.
postgres_sku                   = "GP_Standard_D4ds_v5"
postgres_storage_mb            = 131072
postgres_backup_retention_days = 35
postgres_high_availability     = true
postgres_geo_redundant_backup  = true

zone_redundant = true
api            = { cpu = 2, memory = "4Gi", min_replicas = 2, max_replicas = 6 }
web            = { cpu = 0.5, memory = "1Gi", min_replicas = 2, max_replicas = 4 }

uploads_replication = "GZRS"
uploads_quota_gb    = 500
uploads_backup      = true

smtp_enabled     = true
entra_sign_in    = { enabled = true, tenant_id = "00000000-0000-0000-0000-000000000000", client_id = "00000000-0000-0000-0000-000000000000" } # TISPH
sftp_enabled     = true
sftp_users       = {} # TISPH: SAP pick-up and bank accounts with their SSH public keys
sftp_allowed_ips = []

# Toyota Insurance Services brand pack, enabled once at the first start (deploy/REFERENCE.md)
brand_pack = "toyota-insurance-services"

waf_mode           = "Prevention"
log_retention_days = 365

github_repository  = "IortaTexhNXT-DEV/BDOI-OOTB"
github_environment = "azure-prod"

key_vault_admins = [] # TISPH: object ID of the group that manages secrets
operator_ips     = [] # TISPH: addresses of the operators running Terraform (CIDR)
alert_emails     = [] # TISPH: operations mailbox
