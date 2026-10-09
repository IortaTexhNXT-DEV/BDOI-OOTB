# BrokerVerse UAT on Azure. Values marked TISPH come from TISPH IT; the rest are the sizing agreed for UAT.
# No secret belongs here: secrets live in the environment's Key Vault (deploy/AZURE.md, section 5).

subscription_id = "00000000-0000-0000-0000-000000000000" # TISPH: subscription of the BrokerVerse environments
environment     = "uat"
location        = "southeastasia"
address_space   = "10.42.0.0/16"
cost_center     = "" # TISPH

# shared registry (outputs of deploy/azure/shared); the images of the first deployment, later set by the pipeline
acr_id           = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-tisph-bv-shared/providers/Microsoft.ContainerRegistry/registries/acrtisphbvxxxxx"
acr_login_server = "acrtisphbvxxxxx.azurecr.io"
api_image        = "acrtisphbvxxxxx.azurecr.io/brokerverse-api:bootstrap"
web_image        = "acrtisphbvxxxxx.azurecr.io/brokerverse-web:bootstrap"

# TISPH: e.g. "brokerverse-uat.<tisph domain>" (CNAME to the Front Door endpoint); empty = the *.azurefd.net address
public_host_name  = ""
environment_label = "UAT"

postgres_sku                   = "GP_Standard_D2ds_v5"
postgres_storage_mb            = 65536
postgres_backup_retention_days = 14
postgres_high_availability     = false
postgres_geo_redundant_backup  = false

zone_redundant = false
api            = { cpu = 1, memory = "2Gi", min_replicas = 1, max_replicas = 2 }
web            = { cpu = 0.25, memory = "0.5Gi", min_replicas = 1, max_replicas = 2 }

uploads_replication = "ZRS"
uploads_quota_gb    = 100
uploads_backup      = true

smtp_enabled  = true
entra_sign_in = { enabled = true, tenant_id = "00000000-0000-0000-0000-000000000000", client_id = "00000000-0000-0000-0000-000000000000" } # TISPH
sftp_enabled  = true
sftp_users    = {}

# Toyota Insurance Services brand pack, enabled once at the first start (deploy/REFERENCE.md)
brand_pack = "toyota-insurance-services"

waf_mode           = "Prevention"
log_retention_days = 90

github_repository  = "IortaTexhNXT-DEV/BDOI-OOTB"
github_environment = "azure-uat"

key_vault_admins = [] # TISPH: object ID of the group that manages secrets
operator_ips     = [] # TISPH: addresses of the operators running Terraform (CIDR)
alert_emails     = [] # TISPH: operations mailbox
