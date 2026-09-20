resource "google_secret_manager_secret" "staging" {
  for_each  = toset(local.secret_ids)
  secret_id = each.key
  project   = var.project_id

  labels = local.common_labels

  replication {
    auto {}
  }

  lifecycle {
    prevent_destroy = true
  }
}

# Secret *values* are never managed by Terraform in this readiness lot.
# Owner creates versions manually after authorization (see docs/staging/SECRETS_MATRIX.md).
