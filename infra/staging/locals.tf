locals {
  forbidden_production_names = toset([
    "bicuni-online",
    "bicuni-postgres",
    "bicuni-storage-504414",
    "bicuni.online",
    "www.bicuni.online",
  ])

  common_labels = merge(var.labels, {
    environment = "staging"
    region      = var.region
  })

  runtime_sa_id    = "${var.name_prefix}-runtime"
  runtime_sa_email = "${local.runtime_sa_id}@${var.project_id}.iam.gserviceaccount.com"

  secret_ids = [
    "DATABASE_URL_STAGING",
    "AUTH_SECRET_STAGING",
  ]

  # Canonical bucket env for the app is GCS_BUCKET. GCS_BUCKET_NAME is legacy-only alias
  # (temporary until 2026-12-31 — see docs/staging/SECRETS_MATRIX.md). Never set production bucket.
  gcs_canonical_env = "GCS_BUCKET"

  assert_no_prod_collision = alltrue([
    !contains(local.forbidden_production_names, var.cloud_run_service_name),
    !contains(local.forbidden_production_names, var.cloud_sql_instance_name),
    !contains(local.forbidden_production_names, var.gcs_bucket_name),
    !contains(local.forbidden_production_names, var.public_app_host),
  ])
}

check "forbid_production_targets" {
  assert {
    condition     = local.assert_no_prod_collision
    error_message = "Staging IaC must never target production resource names."
  }
}
