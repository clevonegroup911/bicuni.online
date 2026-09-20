variable "project_id" {
  type        = string
  description = "GCP project id for staging (must remain bicuni-504414 unless the owner decides otherwise)."
  default     = "bicuni-504414"

  validation {
    condition     = length(var.project_id) > 0
    error_message = "project_id is required."
  }
}

variable "region" {
  type        = string
  description = "Primary region for staging resources."
  default     = "europe-west1"
}

variable "environment" {
  type        = string
  description = "Environment label — must be staging."
  default     = "staging"

  validation {
    condition     = var.environment == "staging"
    error_message = "This stack only manages the staging environment."
  }
}

variable "name_prefix" {
  type        = string
  description = "Resource name prefix; must contain staging and must not collide with production names."
  default     = "bicuni-staging"

  validation {
    condition = (
      can(regex("staging", var.name_prefix)) &&
      !contains([
        "bicuni-online",
        "bicuni-postgres",
        "bicuni-storage-504414",
        "bicuni.online",
        "www.bicuni.online",
      ], var.name_prefix)
    )
    error_message = "name_prefix must contain 'staging' and must not equal a production resource name."
  }
}

variable "cloud_run_service_name" {
  type        = string
  description = "Cloud Run service name for staging."
  default     = "bicuni-staging"

  validation {
    condition     = var.cloud_run_service_name == "bicuni-staging"
    error_message = "Staging Cloud Run must be named bicuni-staging (never bicuni-online)."
  }
}

variable "cloud_sql_instance_name" {
  type        = string
  description = "Cloud SQL instance name for staging (physically isolated)."
  default     = "bicuni-staging-postgres"

  validation {
    condition     = can(regex("staging", var.cloud_sql_instance_name)) && var.cloud_sql_instance_name != "bicuni-postgres"
    error_message = "Staging SQL instance must include staging and must not be bicuni-postgres."
  }
}

variable "gcs_bucket_name" {
  type        = string
  description = "Private staging bucket name (canonical app env: GCS_BUCKET)."
  default     = "bicuni-staging-storage-504414"

  validation {
    condition     = can(regex("staging", var.gcs_bucket_name)) && var.gcs_bucket_name != "bicuni-storage-504414"
    error_message = "Staging bucket must include staging and must not be bicuni-storage-504414."
  }
}

variable "artifact_repository_id" {
  type        = string
  description = "Artifact Registry repository id for staging images (may reuse project repo with staging tags)."
  default     = "bicuni"
}

variable "cloud_run_image" {
  type        = string
  description = "Container image URI for staging (digest preferred). Fictitious value for plan-only validation."
  default     = "europe-west1-docker.pkg.dev/bicuni-504414/bicuni/bicuni-staging:plan-only-not-real"
}

variable "cloud_run_min_instances" {
  type        = number
  description = "Cloud Run min instances. Option A = 0; Option B typically >= 1."
  default     = 0
}

variable "cloud_run_max_instances" {
  type        = number
  description = "Cloud Run max instances hard cap for cost control."
  default     = 3
}

variable "cloud_sql_tier" {
  type        = string
  description = "Cloud SQL machine tier. Option A: db-f1-micro; Option B: closer to production."
  default     = "db-f1-micro"
}

variable "cloud_sql_disk_gb" {
  type        = number
  description = "Cloud SQL SSD size in GiB."
  default     = 20
}

variable "redis_enabled" {
  type        = bool
  description = "When true, declares Memorystore Redis (requires redis API enablement by owner)."
  default     = false
}

variable "redis_memory_gb" {
  type        = number
  description = "Memorystore Basic size in GiB when redis_enabled."
  default     = 1
}

variable "public_app_host" {
  type        = string
  description = "Public hostname planned for staging (DNS not managed by this stack until authorized)."
  default     = "staging.bicuni.online"

  validation {
    condition = (
      var.public_app_host == "staging.bicuni.online" ||
      can(regex("\\.run\\.app$", var.public_app_host))
    )
    error_message = "public_app_host must be staging.bicuni.online or a Cloud Run *.run.app host — never bicuni.online / www."
  }
}

variable "allow_unauthenticated" {
  type        = bool
  description = "If true, grants allUsers run.invoker. Default false — owner must explicitly approve."
  default     = false
}

variable "monthly_budget_usd" {
  type        = number
  description = "Maximum controlled monthly budget alert threshold (USD, estimate — not a hard GCP quota)."
  default     = 80
}

variable "billing_account_id" {
  type        = string
  description = "Billing account id for budget alerts. Leave empty to skip budget resource in plan-only mode."
  default     = ""
}

variable "labels" {
  type        = map(string)
  description = "Cost and ownership labels applied to creatable resources."
  default = {
    app         = "bicuni"
    environment = "staging"
    product     = "oaas"
    managed_by  = "terraform"
    cost_center = "bicuni-staging"
  }
}
