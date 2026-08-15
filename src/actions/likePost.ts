import isEmpty from "just-is-empty";
import type { AtProtoAgentType } from "../types";
import { getBSkyAgent } from "./bskyLogin";

export async function likeBskyPost(agent: AtProtoAgentType, data: BSkyRecordTask) {
  if (agent === null || data.cid === undefined || data.uri === undefined) {
    return false;
  }

  console.log(`Attempting to like post ${data.uri} with cid ${data.cid}`);
  try {
    await agent.like(data.uri, data.cid);
    return true;
  } catch(ex) {
    console.warn(`Unable to like record ${data.rkey}, got err: ` + String(ex));
  }
  return false;
}

export async function quickLikeBskyPost(env: Env, data: BSkyRecordTask) {
  if (isEmpty(env.BSKY_APP_PASSWORD))
    return false;

  return await likeBskyPost(await getBSkyAgent(env), data);
}