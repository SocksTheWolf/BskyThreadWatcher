import type {
  AppBskyEmbedExternal, AppBskyEmbedGallery,
  AppBskyEmbedImages, AppBskyEmbedRecord,
  AppBskyEmbedRecordWithMedia, AppBskyFeedPost
} from "@atcute/bluesky";
import type { Blob, CidLink } from "@atcute/lexicons";
import clone from "just-clone";
import { fetchImageAndUpload } from "./r2";
import type { DiscordWebhook } from "./utils";
import { getFXURL, getRecord } from "./urls";

const bskyPostRecordCapture = /at:\/\/(.*)\/app\.bsky\.feed\.post\/(.*)$/;

export async function scrapeBSkyRecord(env: Env, data: BSkyRecordTask): Promise<boolean> {
  if (data.did === env.SKIP_DID) {
    console.log(`${data.rkey} - was a post by a skip author, bailing`);
    return false;
  }
  const maxGalleryImages: number = Number(env.MAX_GALLERY_IMAGES);
  const maxRecurseDepth: number = Number(env.MAX_RECURSE_DEPTH);
  // BIG TIME RUSH FETCH RECORD
  const bskyRecord = await fetch(getRecord(data.did, data.rkey));
  if (bskyRecord.ok) {
    const bskyRecordJson: AppBskyFeedPost.Main = (await bskyRecord.json<RawRecord>()).value;
    let mediaType: string = bskyRecordJson.embed?.$type ?? "";
    let embedPoint: unknown = bskyRecordJson.embed!;

    // If we are a record with media, this is the furthest that we'll go and we'll
    // redirect the embed and media types
    if (mediaType == "app.bsky.embed.recordWithMedia") {
      const externalSchema: AppBskyEmbedRecordWithMedia.Main = (embedPoint as AppBskyEmbedRecordWithMedia.Main);
      mediaType = externalSchema.media.$type;
      embedPoint = externalSchema.media;
    }

    // Try to grab images
    if (mediaType === "app.bsky.embed.images") {
      const imgSchema: AppBskyEmbedImages.Main = (embedPoint as AppBskyEmbedImages.Main);
      for (const embedData of imgSchema.images) {
        // Grab a bunch of info for the image
        const blob: Blob<string> = embedData.image as Blob<string>;
        const blobID: string = (blob.ref as CidLink).$link;
        const mimeType: string = embedData.image.mimeType;
        if (await fetchImageAndUpload(env, data, blobID, mimeType, embedData.alt, embedData.aspectRatio))
          console.log(`${data.rkey} - pulled image ${blobID} from image post`);
        else
          console.warn(`${data.rkey} - could not pull image ${blobID} from image post!`);
      }
    // Handle Galleries
    } else if (mediaType === "app.bsky.embed.gallery") {
      const imgSchema: AppBskyEmbedGallery.Main = (embedPoint as AppBskyEmbedGallery.Main);
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
          console.log(`${data.rkey} - got ${count} image from a gallery`)
        }
      }
    // Copy any external thumbnails and save those too
    } else if (mediaType === "app.bsky.embed.external") {
      const externalData: AppBskyEmbedExternal.External = (embedPoint as AppBskyEmbedExternal.External);
      const thumbData: Blob<string>|undefined = externalData.thumb as Blob<string>|undefined;
      if (thumbData !== undefined) {
        console.log(`${data.rkey} - found link media, pulling thumbnail`);
        await fetchImageAndUpload(env, data, thumbData.ref.$link, thumbData.mimeType);
      } else {
        console.warn(`${data.rkey} - Unable to get thumb data ${data.username}`);
        return false;
      }
    // This is a quote post, just let it go to something...
    // I don't know if it makes sense to error on links with no thumbs...
    } else if (mediaType === "app.bsky.embed.record") {
      if (data.recurseDepth >= maxRecurseDepth) {
        console.warn(`${data.rkey} - hit max record recurse depth, bailing`);
        // I'm not sure if I want to return true or false for this case...
        return false;
      }
      const externalSchema: AppBskyEmbedRecord.Main = (embedPoint as AppBskyEmbedRecord.Main);
      const recordURI = externalSchema.record.uri;
      // check to see if we have a suitable embed
      if (!bskyPostRecordCapture.test(recordURI)) {
        console.error(`${data.rkey} - while traversing, the record embed was not viable ${recordURI}`);
        return false;
      }
      // Recurse and find a post that's valid.
      const newData = data;
      newData.recurseDepth = data.recurseDepth + 1;
      try {
        const regExCapture = bskyPostRecordCapture.exec(recordURI);
        newData.did = regExCapture![1]
        newData.rkey = regExCapture![2];
      } catch (ex: unknown) {
        // if we have a match but somehow the capture group doesn't give us the rkey, then
        // just stop traversing
        console.warn(ex);
        return false;
      }
      return await scrapeBSkyRecord(env, newData);
    } else {
      console.log(`${data.rkey} - NO IMAGE BASED DATA FOUND, SKIPPING`);
      return false;
    }
    return true;
  } else {
    console.error(`${data.rkey} - Could not fetch record for post`);
    return false;
  }
}

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

    // spin up a task to push to discord webhook later.
    if (discordWebhook !== null)
      await discordWebhook.send(fxURL);

    console.log(`Successfully processed ${origData.rkey}!`);
    return true;
  }
  return false;
}