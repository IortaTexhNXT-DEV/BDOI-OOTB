# Remote state for the BrokerVerse Azure stacks (deploy/AZURE.md, section 2). Applied once, by hand, with local state:
#
#   cd deploy/azure/bootstrap
#   terraform init && terraform apply -var="subscription_id=<subscription>"
#
# The outputs are the values of the *.backend.hcl files of the shared and environment stacks. Keep this folder's
# terraform.tfstate somewhere safe (it only describes the state account; it holds no application secret).

terraform {
  required_version = ">= 1.9.0, < 2.0.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.80"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.9"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

variable "subscription_id" {
  description = "Azure subscription that holds the BrokerVerse environments."
  type        = string
}

variable "location" {
  description = "Azure region of the state account."
  type        = string
  default     = "southeastasia"
}

variable "allowed_ips" {
  description = "Public addresses (CIDR) of the operators and runners that run Terraform. Empty: no firewall on the state account."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags on every resource."
  type        = map(string)
  default = {
    application = "BrokerVerse"
    owner       = "TISPH IT"
    purpose     = "terraform-state"
  }
}

resource "random_string" "suffix" {
  length  = 5
  upper   = false
  special = false
}

resource "azurerm_resource_group" "state" {
  name     = "rg-tisph-bv-tfstate"
  location = var.location
  tags     = var.tags
}

resource "azurerm_storage_account" "state" {
  name                            = "sttisphbvtf${random_string.suffix.result}"
  resource_group_name             = azurerm_resource_group.state.name
  location                        = azurerm_resource_group.state.location
  account_tier                    = "Standard"
  account_replication_type        = "RAGZRS"
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true
  tags                            = var.tags

  blob_properties {
    versioning_enabled = true
    delete_retention_policy {
      days = 30
    }
    container_delete_retention_policy {
      days = 30
    }
  }

  dynamic "network_rules" {
    for_each = length(var.allowed_ips) > 0 ? [1] : []
    content {
      default_action = "Deny"
      bypass         = ["AzureServices"]
      ip_rules       = var.allowed_ips
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_storage_container" "state" {
  name                  = "tfstate"
  storage_account_id    = azurerm_storage_account.state.id
  container_access_type = "private"
}

data "azurerm_client_config" "current" {}

# the operator who runs the bootstrap reads and writes state with Entra ID (the account has no shared keys)
resource "azurerm_role_assignment" "state_operator" {
  scope                = azurerm_storage_account.state.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = data.azurerm_client_config.current.object_id
}

resource "azurerm_management_lock" "state" {
  name       = "keep-terraform-state"
  scope      = azurerm_storage_account.state.id
  lock_level = "CanNotDelete"
  notes      = "Terraform state of every BrokerVerse environment."
}

output "backend_config" {
  description = "Values for the *.backend.hcl files (key differs per stack)."
  value = {
    resource_group_name  = azurerm_resource_group.state.name
    storage_account_name = azurerm_storage_account.state.name
    container_name       = azurerm_storage_container.state.name
    use_azuread_auth     = true
  }
}
