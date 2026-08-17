import clone from "just-clone";
import { likeBskyPost } from "./actions/likePost";
import { parseThread } from "./actions/parseThread";
import { scrapeBSkyRecord } from "./actions/scrapeBSkyRecord";
import { getFXURL, total_key } from "./consts";
import { getDiscordWebhook } from "./services/discord";
import { ScrapeResult, type AtProtoAgentType, type DiscordWebhook, type ParseThreadData } from "./types";

export async function handleScrapeTask(env: Env, ctx: ExecutionContext, data: BSkyRecordTask,
  discordWebhook: DiscordWebhook=null, bskyAgent: AtProtoAgentType=null): Promise<boolean> {

  // clone the original data because scrapeBskyRecord can potentially rewrite it.
  const origData: BSkyRecordTask = clone(data);

  // prevent writes from failing
  console.log(`${data.rkey} - handling scrape task`);
  if (await env.KV.get(data.rkey) !== null) {
    console.log(`${data.rkey} - skipping, KV entry already exists`);
    return true;
  }

  const scrapeResult = await scrapeBSkyRecord(env, data);
  if (scrapeResult == ScrapeResult.Success) {
    const fxURL = getFXURL(origData.did, origData.rkey);

    // Valid records get stored and pushed to discord
    await env.KV.put(origData.rkey, fxURL);

    // pass the data object in, it should have the correct fields filled out.
    ctx.waitUntil(likeBskyPost(bskyAgent, data));

    // spin up a task to push to discord webhook later.
    if (discordWebhook !== null)
      ctx.waitUntil(discordWebhook.send(fxURL));

    console.log(`Successfully processed ${origData.rkey}!`);
    return true;
  } else if (scrapeResult == ScrapeResult.NoMedia || scrapeResult === ScrapeResult.SkipAuthor) {
    return true;
  }
  return false;
}


export async function checkThreadsForUpdates(env: Env, ctx: ExecutionContext) {
  const threadData: Map<string, LandmarkData|null|string> = (await env.KV.get<LandmarkData|null>(env.TARGET.threads, "json"));
  threadData.set(total_key, await env.KV.get(total_key, "text"));
  const startingTotal = Number(threadData.get(total_key) ?? 0);

  const data: ParseThreadData = {
    webhook: getDiscordWebhook(env),
    threadData: threadData,
    current_total: startingTotal,
  };

  // support multiple threads
  for (const thread of env.TARGET.threads) {
    await parseThread(env, ctx, thread, data);
  }

  // update the new totals if they changed
  if (startingTotal != data.current_total)
    await env.KV.put(total_key, data.current_total.toString());
}
