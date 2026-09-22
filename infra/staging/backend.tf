terraform {
  backend "gcs" {
    bucket = "bicuni-staging-tfstate-504414"
    prefix = "staging/oaas"
  }
}
