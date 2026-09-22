resource "google_cloud_run_v2_service" "staging" {
  name     = var.cloud_run_service_name
  location = var.region
  project  = var.project_id
  ingress  = "INGRESS_TRAFFIC_ALL"

  labels = local.common_labels

  template {
    service_account = google_service_account.staging_runtime.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.staging.connection_name]
      }
    }

    containers {
      image = var.cloud_run_image

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "BICUNI_ENV"
        value = "staging"
      }

      env {
        name  = "TRUSTED_PROXY_STRATEGY"
        value = "cloud-run"
      }

      env {
        name  = "PUBLIC_APP_URL"
        value = "https://${var.public_app_host}"
      }

      env {
        name  = "AUTH_URL"
        value = "https://${var.public_app_host}"
      }

      env {
        name  = "AUTH_TRUST_HOST"
        value = "true"
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }

      # Canonical name — never bicuni-storage-504414
      env {
        name  = local.gcs_canonical_env
        value = google_storage_bucket.staging.name
      }

      env {
        name  = "REDIS_KEY_PREFIX"
        value = "bicuni-staging"
      }

      env {
        name  = "OAAS_ALLOW_TEST_PAYMENTS"
        value = "1"
      }

      env {
        name  = "EMAIL_FROM"
        value = "BICUNI Staging TEST <noreply-staging@bicuni.online>"
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.staging["DATABASE_URL_STAGING"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "AUTH_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.staging["AUTH_SECRET_STAGING"].secret_id
            version = "latest"
          }
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [client, client_version, scaling]
  }

  depends_on = [
    google_secret_manager_secret_iam_member.staging_secret_access,
    google_secret_manager_secret_version.database_url,
    google_secret_manager_secret_version.auth_secret,
    google_project_iam_member.staging_sql_client,
  ]
}
