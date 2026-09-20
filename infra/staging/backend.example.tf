# Copy to backend.tf only when the owner authorizes remote state.
# Do NOT point the staging state bucket at a production resource name.
#
# terraform {
#   backend "gcs" {
#     bucket = "bicuni-staging-tfstate-CHANGEME"
#     prefix = "staging/oaas"
#   }
# }
