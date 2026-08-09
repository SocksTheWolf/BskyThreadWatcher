import isEmpty from "just-is-empty";
import { AtProtoAgent } from "../services/bskyAgent";

export async function getBSkyAgent(env: Env): Promise<AtProtoAgentType> {
  if (isEmpty(env.BSKY_APP_PASSWORD))
    return null;

  try {
    const agent = new AtProtoAgent();
    const loginResponse = await agent.login({
      identifier: env.BSKY_USERNAME,
      password: env.BSKY_APP_PASSWORD,
    });
    if (loginResponse.success) {
      return agent;
    }
    console.warn(`Could not login to atproto, got data ${loginResponse.data}`);
  } catch(ex) {
    console.warn(`Unable to bsky account, got err: ` + String(ex));
  }
  return null;
}

export type AtProtoAgentType = AtProtoAgent|null;