# Azure Container Apps: the API (internal ingress only), the web app (nginx, public ingress behind Front Door) and the
# migration job the pipeline runs before a new API image takes traffic. Single revision mode: a new revision takes
# over only once its readiness probe (GET /api/health) passes, and the old one drains (graceful shutdown on SIGTERM).
#
# Images are set by the pipeline (.github/workflows/azure-deploy.yml); Terraform sets them only when the app is
# created and otherwise leaves them alone.

resource "azurerm_container_app_environment" "env" {
  name                               = "cae-${local.name}"
  resource_group_name                = azurerm_resource_group.env.name
  location                           = azurerm_resource_group.env.location
  infrastructure_subnet_id           = azurerm_subnet.apps.id
  infrastructure_resource_group_name = "rg-${local.name}-apps-infra"
  internal_load_balancer_enabled     = false
  zone_redundancy_enabled            = var.zone_redundant
  log_analytics_workspace_id         = azurerm_log_analytics_workspace.env.id
  logs_destination                   = "log-analytics"
  tags                               = local.tags

  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"
  }
}

resource "azurerm_container_app_environment_storage" "uploads" {
  name                         = "uploads"
  container_app_environment_id = azurerm_container_app_environment.env.id
  account_name                 = azurerm_storage_account.uploads.name
  share_name                   = azurerm_storage_share.uploads.name
  access_key                   = azurerm_storage_account.uploads.primary_access_key
  access_mode                  = "ReadWrite"

  depends_on = [azurerm_private_endpoint.uploads]
}

locals {
  # Key Vault secrets the API and the migration job receive, by container secret name
  api_secrets = merge(
    {
      "database-url"        = local.kv_secret["database-url"]
      "jwt-secret"          = local.kv_secret["jwt-secret"]
      "data-encryption-key" = local.kv_secret["data-encryption-key"]
      "pii-encryption-key"  = local.kv_secret["pii-encryption-key"]
      "admin-password"      = local.kv_secret["admin-password"]
    },
    var.smtp_enabled ? { "smtp-url" = local.kv_secret["smtp-url"] } : {},
    var.entra_sign_in.enabled ? { "entra-client-secret" = local.kv_secret["entra-client-secret"] } : {},
  )

  api_secret_env = merge(
    {
      DATABASE_URL        = "database-url"
      JWT_SECRET          = "jwt-secret"
      DATA_ENCRYPTION_KEY = "data-encryption-key"
      PII_ENCRYPTION_KEY  = "pii-encryption-key"
      ADMIN_PASSWORD      = "admin-password"
    },
    var.smtp_enabled ? { SMTP_URL = "smtp-url" } : {},
    var.entra_sign_in.enabled ? { ENTRA_CLIENT_SECRET = "entra-client-secret" } : {},
  )

  # Settings of deploy/REFERENCE.md. The browser reaches the API on the web address (/api proxied by the web app),
  # so that address is the CORS origin and the base of the file links.
  api_env = merge(
    {
      NODE_ENV            = "production"
      PORT                = "8000"
      UPLOAD_DIR          = "/app/uploads"
      CORS_ORIGINS        = local.public_url
      PUBLIC_BASE_URL     = local.public_url
      SEED_SAMPLE_DATA    = "false"
      SCHEDULER_ENABLED   = "true"
      LOG_LEVEL           = "info"
      TRUST_PROXY         = var.trust_proxy
      APP_ENVIRONMENT     = local.prod ? "Production" : upper(var.environment)
      SHUTDOWN_TIMEOUT_MS = "25000"
    },
    var.entra_sign_in.enabled ? {
      ENTRA_TENANT_ID    = var.entra_sign_in.tenant_id
      ENTRA_CLIENT_ID    = var.entra_sign_in.client_id
      ENTRA_REDIRECT_URI = "${local.public_url}/login"
    } : {},
  )
}

# ---------------------------------------------------------------------------------------------------------- API
resource "azurerm_container_app" "api" {
  name                         = "ca-${local.name}-api"
  resource_group_name          = azurerm_resource_group.env.name
  container_app_environment_id = azurerm_container_app_environment.env.id
  revision_mode                = "Single"
  workload_profile_name        = "Consumption"
  tags                         = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }

  registry {
    server   = var.acr_login_server
    identity = azurerm_user_assigned_identity.app.id
  }

  dynamic "secret" {
    for_each = local.api_secrets
    content {
      name                = secret.key
      key_vault_secret_id = secret.value
      identity            = azurerm_user_assigned_identity.app.id
    }
  }

  # reachable only from inside the Container Apps environment (the web app's /api proxy)
  ingress {
    external_enabled           = false
    target_port                = 8000
    transport                  = "http"
    allow_insecure_connections = false

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas                     = var.api.min_replicas
    max_replicas                     = var.api.max_replicas
    termination_grace_period_seconds = 30

    container {
      name   = "api"
      image  = var.api_image
      cpu    = var.api.cpu
      memory = var.api.memory

      dynamic "env" {
        for_each = local.api_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.api_secret_env
        content {
          name        = env.key
          secret_name = env.value
        }
      }

      volume_mounts {
        name = "uploads"
        path = "/app/uploads"
      }

      # start-up applies pending migrations before the readiness check passes; allow up to 10 minutes
      startup_probe {
        transport               = "HTTP"
        port                    = 8000
        path                    = "/api/health/live"
        interval_seconds        = 10
        timeout                 = 5
        failure_count_threshold = 60
      }

      readiness_probe {
        transport               = "HTTP"
        port                    = 8000
        path                    = "/api/health"
        interval_seconds        = 10
        timeout                 = 5
        failure_count_threshold = 3
        success_count_threshold = 1
      }

      liveness_probe {
        transport               = "HTTP"
        port                    = 8000
        path                    = "/api/health/live"
        interval_seconds        = 30
        timeout                 = 5
        failure_count_threshold = 3
      }
    }

    # the image runs as user node (uid/gid 1000); the SMB share is mounted with that owner
    volume {
      name          = "uploads"
      storage_type  = "AzureFile"
      storage_name  = azurerm_container_app_environment_storage.uploads.name
      mount_options = "uid=1000,gid=1000,dir_mode=0750,file_mode=0640,nobrl"
    }

    http_scale_rule {
      name                = "http"
      concurrent_requests = "50"
    }
  }

  depends_on = [azurerm_role_assignment.app_acr_pull, azurerm_role_assignment.kv_app, azurerm_private_endpoint.key_vault]

  lifecycle {
    ignore_changes = [template[0].container[0].image, template[0].revision_suffix]
  }
}

# --------------------------------------------------------------------------------------------- migration job
# Run by the pipeline with the new API image before the API is updated: applies pending migrations and the reference
# seed (both idempotent, guarded by an advisory lock), then exits.
resource "azurerm_container_app_job" "migrate" {
  name                         = "caj-${local.name}-migrate"
  resource_group_name          = azurerm_resource_group.env.name
  location                     = azurerm_resource_group.env.location
  container_app_environment_id = azurerm_container_app_environment.env.id
  workload_profile_name        = "Consumption"
  replica_timeout_in_seconds   = 1800
  replica_retry_limit          = 0
  tags                         = local.tags

  manual_trigger_config {
    parallelism              = 1
    replica_completion_count = 1
  }

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }

  registry {
    server   = var.acr_login_server
    identity = azurerm_user_assigned_identity.app.id
  }

  dynamic "secret" {
    for_each = local.api_secrets
    content {
      name                = secret.key
      key_vault_secret_id = secret.value
      identity            = azurerm_user_assigned_identity.app.id
    }
  }

  template {
    container {
      name    = "migrate"
      image   = var.api_image
      cpu     = 0.5
      memory  = "1Gi"
      command = ["sh", "-c", "node src/db/migrate.js && node src/db/seed.js"]

      dynamic "env" {
        for_each = local.api_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.api_secret_env
        content {
          name        = env.key
          secret_name = env.value
        }
      }

      volume_mounts {
        name = "uploads"
        path = "/app/uploads"
      }
    }

    volume {
      name          = "uploads"
      storage_type  = "AzureFile"
      storage_name  = azurerm_container_app_environment_storage.uploads.name
      mount_options = "uid=1000,gid=1000,dir_mode=0750,file_mode=0640,nobrl"
    }
  }

  depends_on = [azurerm_role_assignment.app_acr_pull, azurerm_role_assignment.kv_app, azurerm_private_endpoint.key_vault]

  lifecycle {
    ignore_changes = [template[0].container[0].image]
  }
}

# ---------------------------------------------------------------------------------------------------------- web
resource "azurerm_container_app" "web" {
  name                         = "ca-${local.name}-web"
  resource_group_name          = azurerm_resource_group.env.name
  container_app_environment_id = azurerm_container_app_environment.env.id
  revision_mode                = "Single"
  workload_profile_name        = "Consumption"
  tags                         = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }

  registry {
    server   = var.acr_login_server
    identity = azurerm_user_assigned_identity.app.id
  }

  # public, but nginx answers 403 to anything that did not come through this environment's Front Door (FRONT_DOOR_ID)
  ingress {
    external_enabled           = true
    target_port                = 8080
    transport                  = "http"
    allow_insecure_connections = false

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas                     = var.web.min_replicas
    max_replicas                     = var.web.max_replicas
    termination_grace_period_seconds = 30

    container {
      name   = "web"
      image  = var.web_image
      cpu    = var.web.cpu
      memory = var.web.memory

      env {
        name  = "PORT"
        value = "8080"
      }
      env {
        name  = "API_UPSTREAM"
        value = "https://${azurerm_container_app.api.ingress[0].fqdn}"
      }
      env {
        name  = "ENVIRONMENT_NAME"
        value = var.environment_label
      }
      env {
        name  = "FRONT_DOOR_ID"
        value = azurerm_cdn_frontdoor_profile.env.resource_guid
      }

      # TCP: the HTTP answer is 403 without Front Door's header
      startup_probe {
        transport               = "TCP"
        port                    = 8080
        interval_seconds        = 5
        failure_count_threshold = 12
      }

      liveness_probe {
        transport               = "TCP"
        port                    = 8080
        interval_seconds        = 30
        failure_count_threshold = 3
      }
    }

    http_scale_rule {
      name                = "http"
      concurrent_requests = "100"
    }
  }

  depends_on = [azurerm_role_assignment.app_acr_pull]

  lifecycle {
    ignore_changes = [template[0].container[0].image, template[0].revision_suffix]
  }
}
