# BrokerVerse SIT on Azure. Values marked TISPH come from TISPH IT; the rest are the sizing agreed for SIT.
# No secret belongs here: secrets live in the environment's Key Vault (deploy/AZURE.md, section 5).

subscription_id = "00000000-0000-0000-0000-000000000000" # TISPH: subscription of the BrokerVerse environments
environment     = "sit"
location        = "southeastasia"
address_space   = "10.41.0.0/16"
cost_center     = "" # TISPH

# shared registry (outputs of deploy/azure/shared); the images of the first deployment, later set by the pipeline
acr_id           = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-tisph-bv-shared/providers/Microsoft.ContainerRegistry/registries/acrtisphbvxxxxx"
acr_login_server = "acrtisphbvxxxxx.azurecr.io"
api_image        = "acrtisphbvxxxxx.azurecr.io/brokerverse-api:bootstrap"
web_image        = "acrtisphbvxxxxx.azurecr.io/brokerverse-web:bootstrap"

# TISPH: e.g. "brokerverse-sit.<tisph domain>" (CNAME to the Front Door endpoint); empty = the *.azurefd.net address
public_host_name  = ""
environment_label = "SIT"

postgres_sku                   = "B_Standard_B2s"
postgres_storage_mb            = 32768
postgres_backup_retention_days = 7
postgres_high_availability     = false
postgres_geo_redundant_backup  = false

zone_redundant = false
api            = { cpu = 0.5, memory = "1Gi", min_replicas = 1, max_replicas = 2 }
web            = { cpu = 0.25, memory = "0.5Gi", min_replicas = 1, max_replicas = 2 }

uploads_replication = "LRS"
uploads_quota_gb    = 50
uploads_backup      = false

smtp_enabled  = true
entra_sign_in = { enabled = false, tenant_id = "", client_id = "" }
sftp_enabled  = true
sftp_users    = {}

# Toyota Insurance Services brand pack, enabled once at the first start (deploy/REFERENCE.md)
brand_pack = "toyota-insurance-services"

waf_mode           = "Prevention"
log_retention_days = 30

github_repository  = "IortaTexhNXT-DEV/BDOI-OOTB"
github_environment = "azure-sit"

key_vault_admins = [] # TISPH: object ID of the group that manages secrets
operator_ips     = [] # TISPH: addresses of the operators running Terraform (CIDR)
alert_emails     = [] # TISPH: operations mailbox
