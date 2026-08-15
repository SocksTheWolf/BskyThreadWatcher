export const getRecord = (did: string, rkey: string) => {
  return `https://public.api.bsky.app/xrpc/com.atproto.repo.getRecord?collection=app.bsky.feed.post&repo=${did}&rkey=${rkey}`
}

export const getRecordFeed = (feed: string, cursor?: string|null) => {
  const url = `https://constellation.microcosm.blue/links?target=${encodeURIComponent(feed)}&collection=app.bsky.feed.post&path=.reply.parent.uri`;
  if (cursor !== undefined && cursor !== null) {
    return `${url}&cursor=${cursor}`;
  }
  return url;
}

export const getFXURL = (did: string, rkey: string) => {
  return `https://fxbsky.app/profile/${did}/post/${rkey}`;
}

export const usernameLookup = (did: string) => {
  return `https://plc.directory/${did}`;
}

// the key used for keeping track of the global total of thread records
export const total_key = "global_total";