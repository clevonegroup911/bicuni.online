# BICUNI staging IaC — readiness only

This directory defines an **isolated** staging stack for BICUNI OaaS.

## Absolute rules

- Never run `terraform apply` without a new, explicit owner authorization.
- Never target production names: `bicuni-online`, `bicuni-postgres`,
  `bicuni-storage-504414`, `bicuni.online`, `www.bicuni.online`.
- Never put secret values in `.tf`, `.tfvars`, or git.
- Canonical object-storage env var for the app is `GCS_BUCKET`
  (`GCS_BUCKET_NAME` is a temporary legacy alias until 2026-12-31).

## Allowed local commands

```bash
terraform fmt -check
terraform init -backend=false
terraform validate
terraform plan -refresh=false -var-file=terraform.tfvars.example
```

`terraform plan` with `-refresh=false` and the example tfvars is intended for
static review. It must not create resources. Credentials are not required for
`fmt` / `init -backend=false` / `validate`.

## Layout

| File | Purpose |
| --- | --- |
| `versions.tf` / `providers.tf` | Locked providers |
| `variables.tf` / `locals.tf` | Guardrails + naming |
| `iam.tf` | Staging SA + least privilege |
| `cloud-run.tf` | `bicuni-staging` service |
| `database.tf` | Isolated Postgres + optional Redis |
| `storage.tf` | Private staging bucket |
| `secrets.tf` | Secret **names** only |
| `monitoring.tf` | Staging alerts / optional budget |
| `outputs.tf` | Non-sensitive outputs |

## Related docs

See `docs/staging/` for architecture, costs, secrets, deploy, migration,
rollback, security, test plan, and the owner approval request.
