import { CredentialsSignin } from "@auth/core/errors";

export class AuthRateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

export class AuthTemporarilyUnavailableError extends CredentialsSignin {
  code = "temporarily_unavailable";
}

export class AuthMfaRequiredError extends CredentialsSignin {
  code = "mfa_required";
}
