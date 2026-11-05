import { ApiError } from "./api";

export function authMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "invalid_credentials":
        return "That ID and PIN don't match.";
      case "too_many_attempts":
        return "Too many tries. Wait five minutes, then try again.";
      case "pin_format":
        return "Use six digits.";
      case "session_expired":
        return "Your seven-day session ended. Sign in with your ID and PIN.";
      case "unauthenticated":
        return "Your session ended. Sign in again.";
      case "read_only":
        return "You can read this workspace, but not write to it.";
      case "forbidden":
        return "You don't have access to that workspace.";
      case "no_such_user":
        return "No Daystream ID like that.";
      case "invalid_user":
        return "Enter a six-digit ID.";
      case "id_space_exhausted":
        return "No IDs available right now. Try again later.";
      case "date_required":
        return "Pick a date first.";
      case "template_not_found":
        return "That template is gone.";
      default:
        return "Something didn't go through. Try again.";
    }
  }
  return "Couldn't reach Daystream. Check your connection.";
}
