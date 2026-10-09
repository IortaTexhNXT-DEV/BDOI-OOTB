variable "subscription_id" {
  description = "Azure subscription of the BrokerVerse environments."
  type        = string
}

variable "location" {
  description = "Primary Azure region."
  type        = string
  default     = "southeastasia"
}

variable "replica_location" {
  description = "Second region the registry is replicated to (images stay available for a disaster recovery in that region). Empty: no replica."
  type        = string
  default     = "eastasia"
}

variable "untagged_retention_days" {
  description = "Days an untagged image manifest is kept before the registry deletes it."
  type        = number
  default     = 30
}

variable "tags" {
  description = "Tags on every resource."
  type        = map(string)
  default     = {}
}
