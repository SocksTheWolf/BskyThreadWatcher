import type { Webhook } from "minimal-discord-webhook-node";
import type { AtProtoAgent } from "./services/bskyAgent";

export type DiscordWebhook = Webhook|null;
export type AtProtoAgentType = AtProtoAgent|null;

export interface ParseThreadData {
  webhook: DiscordWebhook;
  threadData: Map<string, LandmarkData|string|null>;
  current_total: number;
}