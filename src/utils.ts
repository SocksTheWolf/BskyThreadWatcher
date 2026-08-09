import isEmpty from "just-is-empty";
// @ts-ignore
import { Webhook } from "minimal-discord-webhook-node";
import { DiscordWebhook } from "./types/webhookType";

export const getDiscordWebhook = (env: Env): DiscordWebhook => {
  return !isEmpty(env.WEBHOOK) ?
    new Webhook({url: env.WEBHOOK, throwErrors: false, retryOnLimit: true}) : null;
}

export const hasThreadToWatch = (env: Env): boolean => {
  return !isEmpty(env.TARGET);
}