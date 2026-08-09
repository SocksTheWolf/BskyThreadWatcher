import { handleScrape } from "./scrapeRecord";
import { checkThreadsForUpdates } from "./threadWatch";
import type { DiscordWebhook } from "./utils";
import { getDiscordWebhook, hasThreadToWatch } from "./utils";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const requestedURL: URL = new URL(request.url);

    // only really useful for local debug
    if (requestedURL.pathname == "/" && hasThreadToWatch(env))
      await checkThreadsForUpdates(env, ctx)

    return new Response("Hello, World");
  },
  async scheduled(_event: ScheduledEvent|null, env: Env, ctx: ExecutionContext) {
    // no thread is set, get out.
    if (!hasThreadToWatch(env))
      return;

    await checkThreadsForUpdates(env, ctx);
  },
  async queue(batch: MessageBatch<BSkyRecordTask>, env: Env, ctx: ExecutionContext) {
    const discordWebhook: DiscordWebhook = getDiscordWebhook(env);
    for (const message of batch.messages) {
      try {
        await handleScrape(env, ctx, message.body, discordWebhook);
        message.ack();
      } catch (err) {
        console.error("Failed to process message, got error: " + String(err));
        message.retry();
      }
    }
  },
};