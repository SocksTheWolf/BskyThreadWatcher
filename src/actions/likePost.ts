import isEmpty from "just-is-empty";
import { AtProtoAgent } from "../services/bskyAgent";

export async function likeBskyPost(env: Env, data: BSkyRecordTask) {
  if (isEmpty(env.BSKY_APP_PASSWORD))
    return false;

  console.log(`Attempting to like post ${data.uri} with cid ${data.cid}`);
  if (data.cid === undefined || data.uri === undefined) {
    return false;
  }

  try {
    const agent = new AtProtoAgent();
    const loginResponse = await agent.login({
      identifier: env.BSKY_USERNAME,
      password: env.BSKY_APP_PASSWORD,
    });

    // we could log in, so go ahead and like the post.
    if (loginResponse.success) {
      await agent.like(data.uri, data.cid);
    } else {
      console.warn(`Could not login to atproto, got data ${loginResponse.data}`);
    }
  } catch(ex) {
    console.warn(`Unable to like record ${data.rkey}, got err: ` + String(ex));
    return false;
  }
  return true;
}