# ---------------------------------------------------------------------------------------------------- identity
variable "environment" {
  description = "Environment code: dev, sit, uat or prod."
  type        = string
  validation {
    condition     = contains(["dev", "sit", "uat", "prod"], var.environment)
    error_message = "environment must be dev, sit, uat or prod."
  }
}

variable "location" {
  description = "Azure region of the environment."
  type        = string
  default     = "southeastasia"
}

variable "tags" {
  description = "Extra tags on every resource (environment, application, owner and cost centre tags are added)."
  type        = map(string)
  default     = {}
}

variable "cost_center" {
  description = "Cost centre tag."
  type        = string
  default     = ""
}

# ---------------------------------------------------------------------------------------------------- network
variable "address_space" {
  description = "Address space of the environment's virtual network (a /16; one per environment, not overlapping TISPH's network if it is ever peered)."
  type        = string
}

# ---------------------------------------------------------------------------------------------------- images
variable "acr_id" {
  description = "Resource ID of the shared container registry (output acr_id of deploy/azure/shared)."
  type        = string
}

variable "acr_login_server" {
  description = "Login server of the shared container registry, e.g. acrtisphbvxxxxx.azurecr.io."
  type        = string
}

variable "api_image" {
  description = "API image for the first deployment (repository@digest or :tag in the shared registry). Later images are set by the pipeline; Terraform does not change them."
  type        = string
}

variable "web_image" {
  description = "Web image for the first deployment. Later images are set by the pipeline."
  type        = string
}

# ---------------------------------------------------------------------------------------------------- addresses
variable "public_host_name" {
  description = "Address users open, e.g. brokerverse-uat.toyota.com.ph (a CNAME to Front Door). Empty: the Front Door endpoint's own *.azurefd.net address."
  type        = string
  default     = ""
}

variable "environment_label" {
  description = "Label shown next to the logo (ENVIRONMENT_NAME): DEV, SIT, UAT. Empty in production."
  type        = string
  default     = ""
}

# ---------------------------------------------------------------------------------------------------- database
variable "postgres_sku" {
  description = "PostgreSQL Flexible Server compute, e.g. B_Standard_B2s (dev), GP_Standard_D2ds_v5, GP_Standard_D4ds_v5 (prod)."
  type        = string
}

variable "postgres_storage_mb" {
  description = "Initial PostgreSQL storage in MB (grows automatically)."
  type        = number
  default     = 65536
}

variable "postgres_backup_retention_days" {
  description = "Point-in-time restore window in days (7 to 35)."
  type        = number
  default     = 7
}

variable "postgres_high_availability" {
  description = "Zone-redundant standby with automatic failover (General Purpose or Memory Optimized compute only)."
  type        = bool
  default     = false
}

variable "postgres_geo_redundant_backup" {
  description = "Copy the backups to the paired region for a regional disaster recovery (geo-restore). Cannot be changed after creation."
  type        = bool
  default     = false
}

# ---------------------------------------------------------------------------------------------------- compute
variable "zone_redundant" {
  description = "Spread the Container Apps environment across availability zones."
  type        = bool
  default     = false
}

variable "api" {
  description = "API container size and replicas."
  type = object({
    cpu          = number
    memory       = string
    min_replicas = number
    max_replicas = number
  })
  default = { cpu = 1, memory = "2Gi", min_replicas = 1, max_replicas = 2 }
}

variable "web" {
  description = "Web (nginx) container size and replicas."
  type = object({
    cpu          = number
    memory       = string
    min_replicas = number
    max_replicas = number
  })
  default = { cpu = 0.25, memory = "0.5Gi", min_replicas = 1, max_replicas = 2 }
}

variable "trust_proxy" {
  description = "TRUST_PROXY of the API: proxies between the browser and the API (Front Door, the web app's ingress, its nginx, the API's ingress)."
  type        = string
  default     = "4"
}

# ---------------------------------------------------------------------------------------------------- documents
variable "uploads_replication" {
  description = "Redundancy of the documents share: LRS, ZRS, GRS or GZRS (geo-redundant in production)."
  type        = string
  default     = "LRS"
}

variable "uploads_quota_gb" {
  description = "Size limit of the documents share in GB."
  type        = number
  default     = 100
}

variable "uploads_backup" {
  description = "Azure Backup snapshots of the documents share every four hours, kept 30 days (plus weekly and monthly copies in production)."
  type        = bool
  default     = false
}

# ---------------------------------------------------------------------------------------------------- integrations
variable "smtp_enabled" {
  description = "Pass SMTP_URL (Key Vault secret smtp-url, created by an operator) to the API. Off: e-mails stay in the outbox."
  type        = bool
  default     = false
}

variable "entra_sign_in" {
  description = "Sign-in with Microsoft Entra ID. client_secret is not here: an operator stores it as Key Vault secret entra-client-secret."
  type = object({
    enabled   = bool
    tenant_id = string
    client_id = string
  })
  default = { enabled = false, tenant_id = "", client_id = "" }
}

variable "sftp_enabled" {
  description = "SFTP endpoint (Azure Storage SFTP) for the SAP text files and bank files."
  type        = bool
  default     = false
}

variable "sftp_users" {
  description = "SFTP accounts: name => SSH public key, home container and whether it may write (true for the bank upload accounts, false for SAP pick-up)."
  type = map(object({
    ssh_public_key = string
    container      = string
    write          = bool
  }))
  default = {}
}

variable "sftp_allowed_ips" {
  description = "Public addresses (CIDR) allowed to reach the SFTP endpoint (SAP, the banks, TISPH offices)."
  type        = list(string)
  default     = []
}

# ---------------------------------------------------------------------------------------------------- security
variable "waf_mode" {
  description = "Front Door WAF mode: Detection (log only, while tuning) or Prevention."
  type        = string
  default     = "Prevention"
  validation {
    condition     = contains(["Detection", "Prevention"], var.waf_mode)
    error_message = "waf_mode must be Detection or Prevention."
  }
}

variable "sign_in_rate_limit_per_minute" {
  description = "Requests per minute one client address may send to /api/auth/ before Front Door blocks it for the rest of the minute."
  type        = number
  default     = 60
}

variable "key_vault_admins" {
  description = "Object IDs of the Entra ID users or groups that manage this environment's secrets (Key Vault Secrets Officer)."
  type        = list(string)
  default     = []
}

variable "operator_ips" {
  description = "Public addresses (CIDR) of the operators and runners that run Terraform or set secrets: allowed through the Key Vault and storage firewalls."
  type        = list(string)
  default     = []
}

# ---------------------------------------------------------------------------------------------------- delivery
variable "github_repository" {
  description = "GitHub repository (owner/name) whose workflow deploys this environment through OIDC."
  type        = string
}

variable "github_environment" {
  description = "GitHub environment of the deployment job (dev, sit, uat, prod); the federated credential is limited to it."
  type        = string
}

variable "github_can_push_images" {
  description = "The pipeline identity of this environment builds and pushes images (dev only; the others promote existing digests)."
  type        = bool
  default     = false
}

# ---------------------------------------------------------------------------------------------------- monitoring
variable "alert_emails" {
  description = "Addresses that receive availability, database and certificate alerts."
  type        = list(string)
  default     = []
}

variable "log_retention_days" {
  description = "Days the Log Analytics workspace keeps logs."
  type        = number
  default     = 30
}
