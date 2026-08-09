import { Agent, CredentialSession } from "@atproto/api";
import isEmpty from "just-is-empty";

export async function likeBskyPost(env: Env, data: BSkyRecordTask) {
  if (isEmpty(env.BSKY_APP_PASSWORD) || data.cid === undefined || data.uri === undefined)
    return;

  try {
    const session = new CredentialSession(new URL("https://bsky.social"));
    const loginResponse = await session.login({
      identifier: env.BSKY_USERNAME,
      password: env.BSKY_APP_PASSWORD,
    });

    // we could log in, so go ahead and like the post.
    if (loginResponse.success) {
      const agent = new Agent(session);
      await agent.like(data.uri, data.cid);
    }
  } catch(ex) {
    console.warn(`Unable to like record ${data.rkey}, got err: ` + String(ex));
    return false;
  }
  return true;
}