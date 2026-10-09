# State of the UAT environment (storage account from the outputs of deploy/azure/bootstrap).
resource_group_name  = "rg-tisph-bv-tfstate"
storage_account_name = "sttisphbvtfxxxxx"
container_name       = "tfstate"
key                  = "uat.tfstate"
use_azuread_auth     = true
