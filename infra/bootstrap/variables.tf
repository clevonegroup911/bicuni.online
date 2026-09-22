variable "project_id" {
  description = "GCP project ID for BICUNI staging."
  type        = string
}

variable "region" {
  description = "GCP region used for staging infrastructure."
  type        = string
  default     = "europe-west1"
}
