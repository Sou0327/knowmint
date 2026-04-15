/**
 * API key lifecycle email notifications.
 *
 * Centralizes the POST/DELETE email paths from `src/app/api/v1/keys/route.ts`
 * so the "auth.email shortcut → getUserById fallback → sendEmail" chain
 * lives in one place.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "./send";
import {
  apiKeyCreatedEmailHtml,
  apiKeyDeletedEmailHtml,
} from "./templates";
import { fireAndForget } from "@/lib/async/fire-and-forget";

export type ApiKeyEvent =
  | { kind: "created"; keyName: string; permissions: string[] }
  | { kind: "deleted"; keyName: string };

export interface ApiKeyEventRecipient {
  userId: string;
  /** If already known from the session, skip the Supabase Admin lookup. */
  email?: string;
}

function renderEmail(event: ApiKeyEvent): {
  subject: string;
  html: string;
  text: string;
} {
  if (event.kind === "created") {
    return apiKeyCreatedEmailHtml({
      keyName: event.keyName,
      permissions: event.permissions,
    });
  }
  return apiKeyDeletedEmailHtml({ keyName: event.keyName });
}

/**
 * Send the notification mail for an API key lifecycle event. Fire-and-forget:
 * the returned promise is wired through `fireAndForget` so a failing email
 * provider never breaks the key-management request.
 *
 * The signature accepts an existing Supabase Admin client so we do not
 * instantiate a new one for a side-effect path, and an optional `email`
 * that lets session-authenticated flows avoid a redundant `getUserById`.
 */
export function sendApiKeyEventEmail(
  admin: SupabaseClient,
  recipient: ApiKeyEventRecipient,
  event: ApiKeyEvent,
): void {
  const content = renderEmail(event);
  const context =
    event.kind === "created" ? "email:key.created" : "email:key.deleted";

  if (recipient.email) {
    fireAndForget(sendEmail({ to: recipient.email, ...content }), context);
    return;
  }

  fireAndForget(
    admin.auth.admin.getUserById(recipient.userId).then(({ data }) => {
      const email = data?.user?.email;
      if (!email) return;
      return sendEmail({ to: email, ...content });
    }),
    context,
  );
}
