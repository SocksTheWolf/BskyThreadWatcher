import isEmpty from "just-is-empty";
import { Webhook } from "minimal-discord-webhook-node";
import type { DiscordWebhook } from "../types";

export const getDiscordWebhook = (env: Env): DiscordWebhook => {
  return !isEmpty(env.DISCORD_WEBHOOK) ?
    new Webhook({url: env.DISCORD_WEBHOOK, throwErrors: false, retryOnLimit: true}) : null;
}