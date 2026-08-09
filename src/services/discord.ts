import isEmpty from "just-is-empty";
// @ts-expect-error 7016
import { Webhook } from "minimal-discord-webhook-node";

export const getDiscordWebhook = (env: Env): DiscordWebhook => {
  return !isEmpty(env.WEBHOOK) ?
    new Webhook({url: env.WEBHOOK, throwErrors: false, retryOnLimit: true}) : null;
}
export type DiscordWebhook = Webhook | null;