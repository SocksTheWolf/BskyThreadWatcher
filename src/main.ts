import isEmpty from "just-is-empty";
import { getBSkyAgent } from "./actions/bskyLogin";
import { checkThreadsForUpdates, handleScrapeTask } from "./app";
import { getDiscordWebhook } from "./services/discord";
import type { AtProtoAgentType, DiscordWebhook } from "./types";

const hasThreadsToWatch = (env: Env): boolean => {
  return !isEmpty(env.TARGET.threads);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const requestedURL: URL = new URL(request.url);

    // only really useful for local debug
    if (requestedURL.pathname == "/" && hasThreadsToWatch(env))
      await checkThreadsForUpdates(env, ctx)

    return new Response("Hello, World");
  },
  async scheduled(_event: ScheduledEvent|null, env: Env, ctx: ExecutionContext) {
    // no thread is set, get out.
    if (!hasThreadsToWatch(env))
      return;

    await checkThreadsForUpdates(env, ctx);
  },
  async queue(batch: MessageBatch<BSkyRecordTask>, env: Env, ctx: ExecutionContext) {
    const discordWebhook: DiscordWebhook = getDiscordWebhook(env);
    const bskyAgent: AtProtoAgentType = await getBSkyAgent(env);
    const maxRetryAttempts: number = Number(env.MAX_SCRAPE_ATTEMPTS);
    for (const message of batch.messages) {
      try {
        if (await handleScrapeTask(env, ctx, message.body, discordWebhook, bskyAgent))
          message.ack();
        else if (message.attempts + 1 >= maxRetryAttempts) {
          // If a scrape task is about to hit the max, send a message to the webhook that a message is about to fail
          if (discordWebhook !== null) {
            await discordWebhook.send(`${message.body.thread} - had failed fetch post for ${message.body.rkey}`);
          }
        } else {
          message.retry();
        }
      } catch (err) {
        console.error("Failed to process message, got error: " + String(err));
        message.retry();
      }
    }
  },
};