output "project_id" {
  value       = var.project_id
  description = "GCP project used by the staging stack."
}

output "region" {
  value       = var.region
  description = "Staging region."
}

output "cloud_run_service_name" {
  value       = google_cloud_run_v2_service.staging.name
  description = "Staging Cloud Run service name (must be bicuni-staging)."
}

output "cloud_sql_instance_name" {
  value       = google_sql_database_instance.staging.name
  description = "Staging Cloud SQL instance name (must not be bicuni-postgres)."
}

output "gcs_bucket_name" {
  value       = google_storage_bucket.staging.name
  description = "Staging private bucket — inject as GCS_BUCKET."
}

output "runtime_service_account_email" {
  value       = google_service_account.staging_runtime.email
  description = "Staging runtime service account email."
}

output "secret_ids" {
  value       = sort([for s in google_secret_manager_secret.staging : s.secret_id])
  description = "Staging Secret Manager secret ids (names only)."
}

output "public_app_host" {
  value       = var.public_app_host
  description = "Planned staging public host."
}

output "forbidden_production_names" {
  value       = sort(tolist(local.forbidden_production_names))
  description = "Production names this stack refuses to target."
}

output "apply_authorized" {
  value       = false
  description = "Hard-coded false in readiness lot — owner must flip process, not this output, before apply."
}
