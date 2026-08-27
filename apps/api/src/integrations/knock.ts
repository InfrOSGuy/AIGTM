/**
 * Knock-ai notification adapter (docs/PRD-IT-INFRA-SCANNER.md §5):
 * replaces a bespoke Slack-webhook alert with Knock's workflow-trigger
 * API, so the qualified-hit event can fan out to Slack today and other
 * channels later without AIGTM hand-rolling multi-channel delivery.
 *
 * Wired to Knock's documented workflow-trigger endpoint on a
 * best-effort basis — confirm request shape (recipients, workflow key)
 * against Knock's current API reference and the actual workflow set up
 * in the Knock dashboard before depending on this in production.
 */

export interface QualifiedHitNotification {
  companyName: string;
  signalType: string;
  score: number;
  quote: string;
  sourceUrl: string;
}

export interface NotificationSender {
  sendQualifiedHit(notification: QualifiedHitNotification): Promise<void>;
}

const KNOCK_WORKFLOWS_BASE_URL = "https://api.knock.app/v1/workflows";

export interface KnockSenderConfig {
  apiKey: string;
  workflowKey: string;
  /** Knock recipient id(s) to notify — e.g. the GTM user's Knock user id. */
  recipients: string[];
}

export function createKnockSender(config: KnockSenderConfig): NotificationSender {
  return {
    async sendQualifiedHit(notification: QualifiedHitNotification) {
      const res = await fetch(`${KNOCK_WORKFLOWS_BASE_URL}/${config.workflowKey}/trigger`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          recipients: config.recipients,
          data: notification,
        }),
      });

      if (!res.ok) {
        throw new Error(`Knock notification trigger failed: ${res.status} ${res.statusText}`);
      }
    },
  };
}

/** Used when Knock isn't configured — the pipeline still persists signals, it just doesn't alert. */
export function createNullNotificationSender(): NotificationSender {
  return {
    async sendQualifiedHit() {
      // intentionally a no-op
    },
  };
}
