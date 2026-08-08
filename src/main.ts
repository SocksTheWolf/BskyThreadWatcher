import { checkThreadForUpdates } from "./threadWatch";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const requestedURL: URL = new URL(request.url);
    if (requestedURL.pathname == "/")
      await checkThreadForUpdates(env, ctx, env.TARGET)
    return new Response("Hello, World");
  },
  async scheduled(_event: ScheduledEvent|null, env: Env, ctx: ExecutionContext) {
    await checkThreadForUpdates(env, ctx, env.TARGET);
  }
};