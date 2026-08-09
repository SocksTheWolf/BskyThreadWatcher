import type { ComAtprotoServerCreateSession } from "@atproto/api";
import { Agent, CredentialSession } from "@atproto/api";

// Code mostly adapted from SkyScheduler.
export class AtProtoAgent extends Agent {
  constructor() {
    super(new CredentialSession(new URL("https://bsky.social")));
  }
  async login(options: AtProtoAgentLoginOptions): Promise<ComAtprotoServerCreateSession.Response> {
    return (this.sessionManager as CredentialSession).login(options);
  }
};