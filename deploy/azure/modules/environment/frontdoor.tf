# Azure Front Door Premium in front of the web app: TLS for the custom domain (managed certificate), the WAF with the
# Microsoft default rule set (OWASP top-10 protections) and bot protection, a rate limit on the sign-in endpoints,
# and caching of the content-hashed bundles under /static/. Everything else is passed through uncached.

resource "azurerm_cdn_frontdoor_profile" "env" {
  name                     = "afd-${local.name}"
  resource_group_name      = azurerm_resource_group.env.name
  sku_name                 = "Premium_AzureFrontDoor"
  response_timeout_seconds = 120
  tags                     = local.tags
}

resource "azurerm_cdn_frontdoor_endpoint" "web" {
  name                     = "fde-${local.name}"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.env.id
  tags                     = local.tags
}

# One origin: no health probe (Front Door sends traffic to the only origin either way).
resource "azurerm_cdn_frontdoor_origin_group" "web" {
  name                     = "web"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.env.id
  session_affinity_enabled = false

  load_balancing {
    sample_size                 = 4
    successful_samples_required = 3
  }
}

resource "azurerm_cdn_frontdoor_origin" "web" {
  name                           = "web"
  cdn_frontdoor_origin_group_id  = azurerm_cdn_frontdoor_origin_group.web.id
  enabled                        = true
  host_name                      = azurerm_container_app.web.ingress[0].fqdn
  origin_host_header             = azurerm_container_app.web.ingress[0].fqdn
  certificate_name_check_enabled = true
  http_port                      = 80
  https_port                     = 443
  priority                       = 1
  weight                         = 1000
}

resource "azurerm_cdn_frontdoor_custom_domain" "web" {
  count                    = var.public_host_name != "" ? 1 : 0
  name                     = replace(var.public_host_name, ".", "-")
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.env.id
  host_name                = var.public_host_name

  tls {
    certificate_type = "ManagedCertificate"
  }
}

locals {
  custom_domain_ids = [for d in azurerm_cdn_frontdoor_custom_domain.web : d.id]
}

resource "azurerm_cdn_frontdoor_route" "app" {
  name                            = "app"
  cdn_frontdoor_endpoint_id       = azurerm_cdn_frontdoor_endpoint.web.id
  cdn_frontdoor_origin_group_id   = azurerm_cdn_frontdoor_origin_group.web.id
  cdn_frontdoor_origin_ids        = [azurerm_cdn_frontdoor_origin.web.id]
  cdn_frontdoor_custom_domain_ids = local.custom_domain_ids
  patterns_to_match               = ["/*"]
  supported_protocols             = ["Http", "Https"]
  https_redirect_enabled          = true
  forwarding_protocol             = "HttpsOnly"
  link_to_default_domain          = true
}

resource "azurerm_cdn_frontdoor_route" "static" {
  name                            = "static"
  cdn_frontdoor_endpoint_id       = azurerm_cdn_frontdoor_endpoint.web.id
  cdn_frontdoor_origin_group_id   = azurerm_cdn_frontdoor_origin_group.web.id
  cdn_frontdoor_origin_ids        = [azurerm_cdn_frontdoor_origin.web.id]
  cdn_frontdoor_custom_domain_ids = local.custom_domain_ids
  patterns_to_match               = ["/static/*"]
  supported_protocols             = ["Http", "Https"]
  https_redirect_enabled          = true
  forwarding_protocol             = "HttpsOnly"
  link_to_default_domain          = true

  cache {
    query_string_caching_behavior = "IgnoreQueryString"
    compression_enabled           = true
    content_types_to_compress     = ["application/javascript", "text/css", "image/svg+xml", "application/json"]
  }
}

resource "azurerm_cdn_frontdoor_custom_domain_association" "web" {
  count                          = var.public_host_name != "" ? 1 : 0
  cdn_frontdoor_custom_domain_id = azurerm_cdn_frontdoor_custom_domain.web[0].id
  cdn_frontdoor_route_ids        = [azurerm_cdn_frontdoor_route.app.id, azurerm_cdn_frontdoor_route.static.id]
}

resource "azurerm_cdn_frontdoor_firewall_policy" "env" {
  name                              = "waf${local.short}"
  resource_group_name               = azurerm_resource_group.env.name
  sku_name                          = "Premium_AzureFrontDoor"
  enabled                           = true
  mode                              = var.waf_mode
  request_body_check_enabled        = true
  custom_block_response_status_code = 403
  tags                              = local.tags

  custom_rule {
    name                           = "SignInRateLimit"
    enabled                        = true
    priority                       = 10
    type                           = "RateLimitRule"
    action                         = "Block"
    rate_limit_duration_in_minutes = 1
    rate_limit_threshold           = var.sign_in_rate_limit_per_minute

    match_condition {
      match_variable = "RequestUri"
      operator       = "Contains"
      match_values   = ["/api/auth/"]
      transforms     = ["Lowercase"]
    }
  }

  managed_rule {
    type    = "Microsoft_DefaultRuleSet"
    version = "2.1"
    action  = "Block"
  }

  managed_rule {
    type    = "Microsoft_BotManagerRuleSet"
    version = "1.1"
    action  = "Block"
  }
}

resource "azurerm_cdn_frontdoor_security_policy" "waf" {
  name                     = "waf"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.env.id

  security_policies {
    firewall {
      cdn_frontdoor_firewall_policy_id = azurerm_cdn_frontdoor_firewall_policy.env.id

      association {
        patterns_to_match = ["/*"]

        domain {
          cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_endpoint.web.id
        }

        dynamic "domain" {
          for_each = local.custom_domain_ids
          content {
            cdn_frontdoor_domain_id = domain.value
          }
        }
      }
    }
  }
}
