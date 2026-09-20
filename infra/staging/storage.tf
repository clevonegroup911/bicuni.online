resource "google_storage_bucket" "staging" {
  name                        = var.gcs_bucket_name
  location                    = upper(var.region)
  project                     = var.project_id
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }

  # Google-managed encryption by default (no CMEK block).

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  labels = local.common_labels

  lifecycle {
    prevent_destroy = true
  }
}
