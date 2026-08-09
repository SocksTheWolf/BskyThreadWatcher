import type {
  AppBskyEmbedExternal, AppBskyEmbedGallery,
  AppBskyEmbedImages, AppBskyEmbedRecord, AppBskyFeedPost
} from "@atcute/bluesky";
import type { Blob, CidLink } from "@atcute/lexicons";
import { fetchImageAndUpload } from "./r2";
import type { DiscordWebhook } from "./types/webhookType";
import { getFXURL, getRecord } from "./urls";

const bskyPostRecordCapture = /at:\/\/(?:.*)\/app\.bsky\.feed\.post\/(.*)$/;

export async function scrapeBSkyRecord(env: Env, data: BSkyRecordTask): Promise<boolean> {
  const maxGalleryImages: number = Number(env.MAX_GALLERY_IMAGES);
  const maxRecurseDepth: number = Number(env.MAX_RECURSE_DEPTH);
  // BIG TIME RUSH FETCH RECORD
  const bskyRecord = await fetch(getRecord(data.did, data.rkey));
  if (bskyRecord.ok) {
    const bskyRecordJson: AppBskyFeedPost.Main = (await bskyRecord.json<RawRecord>()).value;
    const mediaType: string = bskyRecordJson.embed?.$type ?? "";
    // Try to grab images
    if (mediaType === "app.bsky.embed.images") {
      const imgSchema: AppBskyEmbedImages.Main = (bskyRecordJson.embed! as AppBskyEmbedImages.Main);
      for (const embedData of imgSchema.images) {
        // Grab a bunch of info for the image
        const blob: Blob<string> = embedData.image as Blob<string>;
        const blobID: string = (blob.ref as CidLink).$link;
        const mimeType: string = embedData.image.mimeType;
        await fetchImageAndUpload(env, data, blobID, mimeType, embedData.alt, embedData.aspectRatio);
      }
    // Handle Galleries
    } else if (mediaType === "app.bsky.embed.gallery") {
      const imgSchema: AppBskyEmbedGallery.Main = (bskyRecordJson.embed! as AppBskyEmbedGallery.Main);
      let count = 0;
        for (const embedData of imgSchema.items) {
          // limit to the first couple of images so we do not go crazy
          if (count >= maxGalleryImages)
            continue;

          const blob: Blob<string> = embedData.image as Blob<string>;
          const blobID: string = (blob.ref as CidLink).$link;
          const mimeType: string = embedData.image.mimeType;
          if (await fetchImageAndUpload(env, data,
              blobID, mimeType, embedData.alt, embedData.aspectRatio)) {
            ++count;
          }
        }
    // Copy any external thumbnails and save those too
    } else if (mediaType === "app.bsky.embed.external") {
      const externalData: AppBskyEmbedExternal.External = (bskyRecordJson.embed! as unknown as AppBskyEmbedExternal.External);
      const thumbData: Blob<string>|undefined = externalData.thumb as Blob<string>|undefined;
      if (thumbData !== undefined) {
        await fetchImageAndUpload(env, data, thumbData.ref.$link, thumbData.mimeType);
      } else {
        console.warn(`Unable to get thumb data for ${data.rkey} by ${data.username}`);
        return false;
      }
    // This is a quote post, just let it go to something...
    // I don't know if it makes sense to error on links with no thumbs...
    } else if (mediaType === "app.bsky.embed.record" || mediaType === "app.bsky.embed.recordWithMedia") {
      if (data.recurseDepth >= maxRecurseDepth) {
        console.warn(`${data.rkey} hit max recurse depth, bailing`);
        // I'm not sure if I want to return true or false for this case...
        return false;
      }
      const externalSchema: AppBskyEmbedRecord.Main = (bskyRecordJson.embed! as AppBskyEmbedRecord.Main);
      const recordURI = externalSchema.record.uri;
      // check to see if we have a suitable embed
      if (!bskyPostRecordCapture.test(recordURI)) {
        return false;
      }
      // Recurse and find a post that's valid.
      const newData = data;
      newData.recurseDepth = data.recurseDepth + 1;
      try {
        newData.rkey = bskyPostRecordCapture.exec(recordURI)![1];
      } catch (_ex: unknown) {
        // if we have a match but somehow the capture group doesn't give us the rkey, then
        // just stop traversing
        return false;
      }
      return await scrapeBSkyRecord(env, newData);
    } else {
      console.log("NO IMAGE BASED DATA FOUND, SKIPPING");
      return false;
    }
    return true;
  } else {
    console.error(`We couldn't fetch the record for ${data.rkey}`);
    return false;
  }
}

export async function handleScrape(env: Env, data: BSkyRecordTask, discordWebhook: DiscordWebhook=null) {
  if (await scrapeBSkyRecord(env, data)) {
    const fxURL = getFXURL(data.did, data.rkey);

    // Valid records get stored and pushed to discord
    await env.KV.put(data.rkey, fxURL);

    // spin up a task to push to discord webhook later.
    if (discordWebhook !== null)
      await discordWebhook.send(fxURL);

    console.log(`Successfully processed ${data.rkey}!`);
    return true;
  }
  return false;
}