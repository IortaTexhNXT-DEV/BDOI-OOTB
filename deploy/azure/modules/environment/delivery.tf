# Identity of this environment's deployment job in GitHub Actions (.github/workflows/azure-deploy.yml). Signed in with
# OpenID Connect: the federated credential trusts only jobs of this repository that run in this GitHub environment,
# so no Azure secret is stored in GitHub. It may change the resources of this environment (images, jobs) and read
# the registry; the dev identity also pushes the images it builds.

resource "azurerm_user_assigned_identity" "github" {
  name                = "id-${local.name}-github"
  resource_group_name = azurerm_resource_group.env.name
  location            = azurerm_resource_group.env.location
  tags                = local.tags
}

resource "azurerm_federated_identity_credential" "github" {
  name                      = "github-${var.github_environment}"
  user_assigned_identity_id = azurerm_user_assigned_identity.github.id
  audience                  = ["api://AzureADTokenExchange"]
  issuer                    = "https://token.actions.githubusercontent.com"
  subject                   = "repo:${var.github_repository}:environment:${var.github_environment}"
}

resource "azurerm_role_assignment" "github_environment" {
  scope                = azurerm_resource_group.env.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_user_assigned_identity.github.principal_id
}

resource "azurerm_role_assignment" "github_registry" {
  scope                = var.acr_id
  role_definition_name = var.github_can_push_images ? "AcrPush" : "AcrPull"
  principal_id         = azurerm_user_assigned_identity.github.principal_id
}
