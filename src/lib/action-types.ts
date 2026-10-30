export type ActionState = {
  error?: string | null;
  ok?: boolean;
  message?: string | null;
  /** One-time credentials returned to admins after create/reset. */
  publicId?: string | null;
  pin?: string | null;
};
