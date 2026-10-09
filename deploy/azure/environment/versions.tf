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
  # one state per environment: terraform init -reconfigure -backend-config=environments/<env>.backend.hcl
  backend "azurerm" {}
}

provider "azurerm" {
  features {
    key_vault {
      # a deleted vault stays recoverable (soft delete); production's is also purge-protected
      purge_soft_delete_on_destroy = false
    }
    resource_group {
      prevent_deletion_if_contains_resources = true
    }
  }
  subscription_id     = var.subscription_id
  storage_use_azuread = true
}
