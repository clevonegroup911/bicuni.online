resource "random_password" "staging_db" {
  length  = 32
  special = false
}

resource "google_sql_database_instance" "staging" {
  name             = var.cloud_sql_instance_name
  database_version = "POSTGRES_16"
  region           = var.region
  project          = var.project_id

  settings {
    edition           = "ENTERPRISE"
    tier              = var.cloud_sql_tier
    availability_type = "ZONAL"
    disk_size         = var.cloud_sql_disk_gb
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    # Public IP enabled only for Cloud Run / Cloud SQL Auth Proxy paths.
    # No authorized_networks ⇒ no direct internet client access.
    # Never point the app at bicuni-postgres.
    ip_configuration {
      ipv4_enabled = true
      ssl_mode     = "ENCRYPTED_ONLY"
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "02:00"
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = 7
      }
    }

    insights_config {
      query_insights_enabled = true
    }

    user_labels = local.common_labels
  }

  deletion_protection = true

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_sql_database" "staging" {
  name     = "bicuni_staging"
  instance = google_sql_database_instance.staging.name
  project  = var.project_id
}

resource "google_sql_user" "staging" {
  name     = "bicuni_staging"
  instance = google_sql_database_instance.staging.name
  project  = var.project_id
  password = random_password.staging_db.result
}

# Optional Memorystore — disabled by default (Option A). Enabling requires owner
# approval to turn on redis.googleapis.com (billable API).
resource "google_redis_instance" "staging" {
  count          = var.redis_enabled ? 1 : 0
  name           = "${var.name_prefix}-redis"
  tier           = "BASIC"
  memory_size_gb = var.redis_memory_gb
  region         = var.region
  project        = var.project_id
  redis_version  = "REDIS_7_0"

  labels = local.common_labels

  lifecycle {
    prevent_destroy = true
  }
}
