# Virtual network: the Container Apps environment, PostgreSQL (delegated subnet, private access only) and the
# private endpoints of Key Vault and storage. Nothing but the web app's ingress is reachable from the internet.

resource "azurerm_virtual_network" "env" {
  name                = "vnet-${local.name}"
  resource_group_name = azurerm_resource_group.env.name
  location            = azurerm_resource_group.env.location
  address_space       = [var.address_space]
  tags                = local.tags
}

resource "azurerm_subnet" "apps" {
  name                 = "snet-apps"
  resource_group_name  = azurerm_resource_group.env.name
  virtual_network_name = azurerm_virtual_network.env.name
  address_prefixes     = [cidrsubnet(var.address_space, 7, 0)]

  delegation {
    name = "container-apps"
    service_delegation {
      name    = "Microsoft.App/environments"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "database" {
  name                 = "snet-database"
  resource_group_name  = azurerm_resource_group.env.name
  virtual_network_name = azurerm_virtual_network.env.name
  address_prefixes     = [cidrsubnet(var.address_space, 8, 2)]
  service_endpoints    = ["Microsoft.Storage"]

  delegation {
    name = "postgresql"
    service_delegation {
      name    = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "endpoints" {
  name                 = "snet-private-endpoints"
  resource_group_name  = azurerm_resource_group.env.name
  virtual_network_name = azurerm_virtual_network.env.name
  address_prefixes     = [cidrsubnet(var.address_space, 8, 3)]
}

# No inbound rule beyond Azure's defaults (virtual network and load balancer only): the internet cannot reach these.
resource "azurerm_network_security_group" "private" {
  name                = "nsg-${local.name}-private"
  resource_group_name = azurerm_resource_group.env.name
  location            = azurerm_resource_group.env.location
  tags                = local.tags
}

resource "azurerm_subnet_network_security_group_association" "database" {
  subnet_id                 = azurerm_subnet.database.id
  network_security_group_id = azurerm_network_security_group.private.id
}

resource "azurerm_subnet_network_security_group_association" "endpoints" {
  subnet_id                 = azurerm_subnet.endpoints.id
  network_security_group_id = azurerm_network_security_group.private.id
}

# Private DNS: the containers resolve the database, Key Vault and storage to their private addresses.
locals {
  private_zones = {
    postgres = "${local.name}.private.postgres.database.azure.com"
    vault    = "privatelink.vaultcore.azure.net"
    file     = "privatelink.file.core.windows.net"
    blob     = "privatelink.blob.core.windows.net"
  }
}

resource "azurerm_private_dns_zone" "zone" {
  for_each            = local.private_zones
  name                = each.value
  resource_group_name = azurerm_resource_group.env.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "zone" {
  for_each              = local.private_zones
  name                  = "link-${each.key}"
  resource_group_name   = azurerm_resource_group.env.name
  private_dns_zone_name = azurerm_private_dns_zone.zone[each.key].name
  virtual_network_id    = azurerm_virtual_network.env.id
  registration_enabled  = false
  tags                  = local.tags
}
