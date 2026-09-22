provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google" {
  alias                 = "billing"
  project               = var.project_id
  region                = var.region
  billing_project       = var.project_id
  user_project_override = true

  # Credentials are NEVER committed. Apply is owner-gated and out of scope for this branch.
  # Plan with -refresh=false uses only local configuration (no cloud mutation).
}

provider "random" {}
