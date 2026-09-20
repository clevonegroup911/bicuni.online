provider "google" {
  project = var.project_id
  region  = var.region

  # Credentials are NEVER committed. Apply is owner-gated and out of scope for this branch.
  # Plan with -refresh=false uses only local configuration (no cloud mutation).
}

provider "random" {}
