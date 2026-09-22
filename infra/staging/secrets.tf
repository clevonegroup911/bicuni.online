resource "random_password" "staging_auth" {
  length  = 64
  special = false
}

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

locals {
  staging_database_url = "postgresql://${google_sql_user.staging.name}:${random_password.staging_db.result}@localhost/${google_sql_database.staging.name}?host=/cloudsql/${google_sql_database_instance.staging.connection_name}"
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.staging["DATABASE_URL_STAGING"].id
  secret_data = local.staging_database_url
}

resource "google_secret_manager_secret_version" "auth_secret" {
  secret      = google_secret_manager_secret.staging["AUTH_SECRET_STAGING"].id
  secret_data = random_password.staging_auth.result
}
