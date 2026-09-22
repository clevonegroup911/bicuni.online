output "terraform_state_bucket" {
  description = "Private bucket reserved for the BICUNI staging Terraform state."
  value       = google_storage_bucket.terraform_state.name
}
