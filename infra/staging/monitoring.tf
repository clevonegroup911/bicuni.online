# Observability placeholders — no production notification channels are modified.
# Budget alerts require an explicit billing_account_id from the owner.

resource "google_monitoring_alert_policy" "staging_cloud_run_5xx" {
  display_name = "bicuni-staging-cloud-run-5xx"
  combiner     = "OR"
  project      = var.project_id
  enabled      = true

  conditions {
    display_name = "Cloud Run 5xx rate (staging)"
    condition_threshold {
      filter          = <<-EOT
        resource.type = "cloud_run_revision"
        AND resource.labels.service_name = "${var.cloud_run_service_name}"
        AND metric.type = "run.googleapis.com/request_count"
        AND metric.labels.response_code_class = "5xx"
      EOT
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  documentation {
    content   = "Staging-only alert. Do not page production on-call for this policy."
    mime_type = "text/markdown"
  }

  user_labels = local.common_labels
}

resource "google_billing_budget" "staging" {
  provider        = google.billing
  count           = var.billing_account_id == "" ? 0 : 1
  billing_account = var.billing_account_id
  display_name    = "bicuni-staging-monthly-cap"

  budget_filter {
    projects = ["projects/${var.project_number}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(ceil(var.monthly_budget_usd))
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }
  threshold_rules {
    threshold_percent = 0.8
  }
  threshold_rules {
    threshold_percent = 1.0
  }
}
