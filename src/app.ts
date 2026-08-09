import clone from "just-clone";
import isEmpty from "just-is-empty";
import { likeBskyPost } from "./actions/likePost";
import { parseThreadUpdates } from "./actions/parseThread";
import { scrapeBSkyRecord } from "./actions/scrapeBSky";
import { getDiscordWebhook, type DiscordWebhook } from "./services/discord";
import { getFXURL } from "./urls";

export async function handleScrape(env: Env, data: BSkyRecordTask, discordWebhook: DiscordWebhook=null) {
  // clone the original data because scrapeBskyRecord can potentially rewrite it.
  const origData: BSkyRecordTask = clone(data);

  // prevent writes from failing
  console.log(`${data.rkey} - handling scrape task`);
  if (await env.KV.get(data.rkey) !== null) {
    console.log(`${data.rkey} - skipping, KV entry already exists`);
    return true;
  }

  if (await scrapeBSkyRecord(env, data)) {
    const fxURL = getFXURL(origData.did, origData.rkey);

    // Valid records get stored and pushed to discord
    await env.KV.put(origData.rkey, fxURL);

    // pass the data object in, it should have the correct fields filled out.
    if (!isEmpty(env.BSKY_APP_PASSWORD)) {
      console.log(`Attempting to like post ${data.uri}`);
      await likeBskyPost(env, data);
    }

    // spin up a task to push to discord webhook later.
    if (discordWebhook !== null)
      await discordWebhook.send(fxURL);

    console.log(`Successfully processed ${origData.rkey}!`);
    return true;
  }
  return false;
}

export async function checkThreadsForUpdates(env: Env, ctx: ExecutionContext) {
  const webhook: DiscordWebhook = getDiscordWebhook(env);
  // support multiple threads
  for (const thread of env.TARGET.values) {
    await parseThreadUpdates(env, ctx, thread, webhook);
  }
}
