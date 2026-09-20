resource "google_service_account" "staging_runtime" {
  account_id   = local.runtime_sa_id
  display_name = "BICUNI Staging Runtime"
  description  = "Least-privilege runtime identity for bicuni-staging Cloud Run. Never reuse production SA."
  project      = var.project_id
}

# Cloud SQL client — staging instance only (enforced by connection name in app config).
resource "google_project_iam_member" "staging_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.staging_runtime.email}"
}

resource "google_project_iam_member" "staging_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.staging_runtime.email}"
}

resource "google_project_iam_member" "staging_metric_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.staging_runtime.email}"
}

# Secret access is scoped per secret below (not project-wide secretAccessor).
resource "google_secret_manager_secret_iam_member" "staging_secret_access" {
  for_each  = toset(local.secret_ids)
  project   = var.project_id
  secret_id = google_secret_manager_secret.staging[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.staging_runtime.email}"
}

resource "google_storage_bucket_iam_member" "staging_objects" {
  bucket = google_storage_bucket.staging.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.staging_runtime.email}"
}

# Optional invoker for humans via IAP/group — never allUsers unless allow_unauthenticated.
resource "google_cloud_run_v2_service_iam_member" "staging_invoker_public" {
  count    = var.allow_unauthenticated ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.staging.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
