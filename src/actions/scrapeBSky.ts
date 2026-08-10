/* eslint-disable @typescript-eslint/no-unnecessary-type-conversion */
import type {
  AppBskyEmbedExternal, AppBskyEmbedGallery,
  AppBskyEmbedImages, AppBskyEmbedRecord,
  AppBskyEmbedRecordWithMedia, AppBskyFeedPost
} from "@atcute/bluesky";
import type { Blob } from "@atcute/lexicons";
import isEmpty from "just-is-empty";
import { fetchImageAndUpload, saveRecordText } from "../services/r2";
import { getRecord } from "../urls";

const bskyPostRecordCapture = /at:\/\/(.*)\/app\.bsky\.feed\.post\/(.*)$/;

export async function scrapeBSkyRecord(env: Env, data: BSkyRecordTask): Promise<boolean> {
  if (data.did === env.SKIP_DID) {
    console.log(`${data.rkey} - was a post by a skip author, bailing`);
    return false;
  }

  // if the record was somehow invalid, break out now. Do not continue.
  if (isEmpty(data.did) || isEmpty(data.rkey)) {
    console.warn("data provided was invalid, breaking out.");
    return false;
  }

  // these need to convert because historically workers injects as a string
  const maxGalleryImages: number = Number(env.MAX_GALLERY_IMAGES);
  const maxRecurseDepth: number = Number(env.MAX_RECURSE_DEPTH);
  const isFirstRecurse: boolean = data.recurseDepth <= 0;
  // BIG TIME RUSH FETCH RECORD
  const bskyRecord = await fetch(getRecord(data.did, data.rkey));
  if (bskyRecord.ok) {

    const bskyRawRecord: RawRecord = await bskyRecord.json<RawRecord>();
    const bskyRecordJson: AppBskyFeedPost.Main = bskyRawRecord.value as AppBskyFeedPost.Main;

    if (isFirstRecurse) {
      data.cid = bskyRawRecord.cid;
      data.uri = bskyRawRecord.uri;

      // Save the post text
      if (!isEmpty(bskyRecordJson.text))
        await saveRecordText(env, data, bskyRecordJson.text);
    }

    let mediaType: string = bskyRecordJson.embed?.$type ?? "";
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
        const blob: Blob = embedData.image as Blob;
        const blobID: string = (blob.ref).$link;
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

        const blob: Blob = embedData.image as Blob;
        const blobID: string = (blob.ref).$link;
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
      const thumbData: Blob|undefined = externalData.thumb as Blob|undefined;
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
        newData.did = regExCapture?.[1] ?? "";
        newData.rkey = regExCapture?.[2] ?? "";
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
