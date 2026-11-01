"use client";

import { useActionState, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  deleteUserAction,
  resetPinAction,
  setUserAdminAction,
  setUserPublicIdAction,
  setUserStatusAction,
} from "@/actions/admin";
import type { ActionState } from "@/lib/action-types";

export type AdminUserRowData = {
  id: string;
  publicId: string;
  name: string;
  email: string | null;
  isAdmin: boolean;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  workspaceCount: number;
  thingCount: number;
  isSelf: boolean;
};

function formatDate(value: string | null): string {
  if (!value) return "never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function AdminUserRow({ user }: { user: AdminUserRowData }) {
  const [statusState, statusAction, statusPending] = useActionState<ActionState, FormData>(
    setUserStatusAction,
    { error: null },
  );
  const [adminState, adminAction, adminPending] = useActionState<ActionState, FormData>(
    setUserAdminAction,
    { error: null },
  );
  const [pinState, pinAction, pinPending] = useActionState<ActionState, FormData>(resetPinAction, {
    error: null,
  });
  const [deleteState, deleteAction, deletePending] = useActionState<ActionState, FormData>(
    deleteUserAction,
    { error: null },
  );
  const [idState, idAction, idPending] = useActionState<ActionState, FormData>(
    setUserPublicIdAction,
    { error: null },
  );

  const deleteFormRef = useRef<HTMLFormElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const busy = statusPending || adminPending || pinPending || deletePending || idPending;
  const feedback = [statusState, adminState, deleteState, idState].find((s) => s.error || s.message);

  return (
    <div className="flex flex-col gap-2 border-t border-edge px-3.5 py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-sm tracking-[0.15em]">{user.publicId}</span>
        <span className="text-sm text-ink">{user.name}</span>
        {user.isAdmin && (
          <span className="rounded-full border border-accent/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-accent">
            admin
          </span>
        )}
        {user.status !== "active" && (
          <span className="rounded-full border border-warning/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-warning">
            {user.status}
          </span>
        )}
        {user.isSelf && <span className="text-[11px] text-muted">(you)</span>}
        <span className="ml-auto text-[11px] text-muted">
          {user.workspaceCount} spaces · {user.thingCount} things · last {formatDate(user.lastLoginAt)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form action={statusAction}>
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="status" value={user.status === "active" ? "suspended" : "active"} />
          <button type="submit" disabled={busy} className="ds-button px-3 py-1.5 text-xs disabled:opacity-40">
            {user.status === "active" ? "Suspend" : "Activate"}
          </button>
        </form>

        <form action={adminAction}>
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="isAdmin" value={user.isAdmin ? "false" : "true"} />
          <button type="submit" disabled={busy} className="ds-button px-3 py-1.5 text-xs disabled:opacity-40">
            {user.isAdmin ? "Remove admin" : "Make admin"}
          </button>
        </form>

        <form action={idAction} className="flex items-center gap-1">
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="currentId" value={user.publicId} />
          <input
            name="publicId"
            defaultValue={user.publicId}
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            aria-label={`Change the ID for ${user.name}`}
            className="w-24 rounded-lg border border-edge bg-raised px-2 py-1 font-mono text-xs tracking-[0.15em] text-ink outline-none focus:border-accent/60"
          />
          <button type="submit" disabled={busy} className="ds-button px-2.5 py-1.5 text-xs disabled:opacity-40">
            Change ID
          </button>
        </form>

        <form action={pinAction}>
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="publicId" value={user.publicId} />
          <button type="submit" disabled={busy} className="ds-button px-3 py-1.5 text-xs disabled:opacity-40">
            Reset PIN
          </button>
        </form>

        <form ref={deleteFormRef} action={deleteAction}>
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="publicId" value={user.publicId} />
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={busy || user.isSelf}
            className="min-h-9 rounded-md px-2.5 text-xs text-danger hover:bg-danger/10 disabled:opacity-30"
          >
            Delete
          </button>
        </form>

        <ConfirmDialog
          open={confirmingDelete}
          title={`Delete user ${user.publicId}?`}
          description={`Their workspaces and Notes go with them. This cannot be undone.`}
          confirmLabel="Delete user"
          destructive
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            setConfirmingDelete(false);
            deleteFormRef.current?.requestSubmit();
          }}
        />
      </div>

      {pinState.ok && pinState.pin && (
        <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 font-mono text-xs text-success">
          New PIN for {pinState.publicId}: <strong className="tracking-[0.2em]">{pinState.pin}</strong>
        </p>
      )}
      {feedback?.error && (
        <p className="text-xs text-danger">{feedback.error}</p>
      )}
      {feedback?.message && !pinState.ok && <p className="text-xs text-muted">{feedback.message}</p>}
    </div>
  );
}
