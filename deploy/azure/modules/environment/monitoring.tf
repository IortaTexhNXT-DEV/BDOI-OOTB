# Logs of every component in one Log Analytics workspace; Application Insights runs the availability test that
# measures the 99.9% target (NFR-15) from outside Azure's network.

resource "azurerm_log_analytics_workspace" "env" {
  name                = "log-${local.name}"
  resource_group_name = azurerm_resource_group.env.name
  location            = azurerm_resource_group.env.location
  sku                 = "PerGB2018"
  retention_in_days   = var.log_retention_days
  tags                = local.tags
}

resource "azurerm_application_insights" "env" {
  name                = "appi-${local.name}"
  resource_group_name = azurerm_resource_group.env.name
  location            = azurerm_resource_group.env.location
  workspace_id        = azurerm_log_analytics_workspace.env.id
  application_type    = "web"
  tags                = local.tags
}

# GET /api/health through Front Door every five minutes from five locations: 200 with "ready":true (database
# reachable, no pending migration).
resource "azurerm_application_insights_standard_web_test" "health" {
  name                    = "avail-${local.name}-health"
  resource_group_name     = azurerm_resource_group.env.name
  location                = azurerm_resource_group.env.location
  application_insights_id = azurerm_application_insights.env.id
  frequency               = 300
  timeout                 = 30
  retry_enabled           = true
  enabled                 = true
  geo_locations           = ["apac-sg-sin-azr", "apac-hk-hkn-azr", "apac-jp-kaw-edge", "emea-nl-ams-azr", "us-va-ash-azr"]
  tags                    = local.tags

  request {
    url = "${local.public_url}/api/health"
  }

  validation_rules {
    expected_status_code        = 200
    ssl_check_enabled           = true
    ssl_cert_remaining_lifetime = 14
    content {
      content_match      = "\"ready\":true"
      ignore_case        = false
      pass_if_text_found = true
    }
  }
}

resource "azurerm_monitor_action_group" "ops" {
  name                = "ag-${local.name}-ops"
  resource_group_name = azurerm_resource_group.env.name
  short_name          = substr("bv${var.environment}ops", 0, 12)
  tags                = local.tags

  dynamic "email_receiver" {
    for_each = toset(var.alert_emails)
    content {
      name                    = replace(email_receiver.value, "/[^A-Za-z0-9]/", "-")
      email_address           = email_receiver.value
      use_common_alert_schema = true
    }
  }
}

resource "azurerm_monitor_metric_alert" "availability" {
  name                = "alert-${local.name}-availability"
  resource_group_name = azurerm_resource_group.env.name
  scopes              = [azurerm_application_insights_standard_web_test.health.id, azurerm_application_insights.env.id]
  description         = "BrokerVerse ${upper(var.environment)} health check failing from two or more locations."
  severity            = local.prod ? 0 : 2
  frequency           = "PT1M"
  window_size         = "PT5M"
  tags                = local.tags

  application_insights_web_test_location_availability_criteria {
    web_test_id           = azurerm_application_insights_standard_web_test.health.id
    component_id          = azurerm_application_insights.env.id
    failed_location_count = 2
  }

  action {
    action_group_id = azurerm_monitor_action_group.ops.id
  }
}

resource "azurerm_monitor_metric_alert" "database" {
  for_each = {
    cpu     = { metric = "cpu_percent", threshold = 85, text = "CPU above 85% for 15 minutes" }
    storage = { metric = "storage_percent", threshold = 85, text = "storage above 85%" }
    memory  = { metric = "memory_percent", threshold = 90, text = "memory above 90% for 15 minutes" }
  }
  name                = "alert-${local.name}-db-${each.key}"
  resource_group_name = azurerm_resource_group.env.name
  scopes              = [azurerm_postgresql_flexible_server.db.id]
  description         = "BrokerVerse ${upper(var.environment)} database: ${each.value.text}."
  severity            = 2
  frequency           = "PT5M"
  window_size         = "PT15M"
  tags                = local.tags

  criteria {
    metric_namespace = "Microsoft.DBforPostgreSQL/flexibleServers"
    metric_name      = each.value.metric
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = each.value.threshold
  }

  action {
    action_group_id = azurerm_monitor_action_group.ops.id
  }
}

resource "azurerm_monitor_diagnostic_setting" "database" {
  name                       = "to-log-analytics"
  target_resource_id         = azurerm_postgresql_flexible_server.db.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.env.id

  enabled_log {
    category = "PostgreSQLLogs"
  }

  enabled_metric {
    category = "AllMetrics"
  }
}

resource "azurerm_monitor_diagnostic_setting" "key_vault" {
  name                       = "to-log-analytics"
  target_resource_id         = azurerm_key_vault.env.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.env.id

  enabled_log {
    category = "AuditEvent"
  }
}

resource "azurerm_monitor_diagnostic_setting" "front_door" {
  name                       = "to-log-analytics"
  target_resource_id         = azurerm_cdn_frontdoor_profile.env.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.env.id

  enabled_log {
    category = "FrontDoorAccessLog"
  }

  enabled_log {
    category = "FrontDoorWebApplicationFirewallLog"
  }

  enabled_metric {
    category = "AllMetrics"
  }
}
