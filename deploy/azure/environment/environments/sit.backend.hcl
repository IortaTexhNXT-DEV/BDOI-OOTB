# State of the SIT environment (storage account from the outputs of deploy/azure/bootstrap).
resource_group_name  = "rg-tisph-bv-tfstate"
storage_account_name = "sttisphbvtfxxxxx"
container_name       = "tfstate"
key                  = "sit.tfstate"
use_azuread_auth     = true
