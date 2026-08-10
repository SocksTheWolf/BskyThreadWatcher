import isEmpty from "just-is-empty";
import type { AtProtoAgentType } from "./actions/bskyLogin";
import { getBSkyAgent } from "./actions/bskyLogin";
import { checkThreadsForUpdates, handleScrape } from "./app";
import type { DiscordWebhook } from "./services/discord";
import { getDiscordWebhook } from "./services/discord";

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
    const bskyAgent: AtProtoAgentType = await getBSkyAgent(env)
    for (const message of batch.messages) {
      try {
        await handleScrape(env, ctx, message.body, discordWebhook, bskyAgent);
        message.ack();
      } catch (err) {
        console.error("Failed to process message, got error: " + String(err));
        message.retry();
      }
    }
  },
};