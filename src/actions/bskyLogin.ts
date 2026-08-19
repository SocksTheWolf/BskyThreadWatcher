import isEmpty from "just-is-empty";
import { AtProtoAgent } from "../services/bskyAgent";
import type { AtProtoAgentType } from "../types";

export async function getBSkyAgent(env: Env): Promise<AtProtoAgentType> {
  if (isEmpty(env.BSKY_APP_PASSWORD))
    return null;

  try {
    const agent = new AtProtoAgent(env);
    const loginResponse = await agent.login({
      identifier: env.BSKY_USERNAME,
      password: env.BSKY_APP_PASSWORD,
    });
    if (loginResponse.success) {
      return agent;
    }
    console.warn(`Could not login to atproto, got data ${loginResponse.data.status}`);
  } catch (ex: unknown) {
    console.warn(`Unable to bsky account, got err: ` + String(ex));
  }
  return null;
}
