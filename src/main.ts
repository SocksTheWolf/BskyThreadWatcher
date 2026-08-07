import type { AppBskyEmbedExternal, AppBskyEmbedGallery, AppBskyEmbedImages, AppBskyFeedPost } from "@atcute/bluesky";
import type { Blob, CidLink } from "@atcute/lexicons";
import { v4 as uuidv4 } from 'uuid';
import isEmpty from "just-is-empty";
import mime from 'mime/lite';
// @ts-ignore
import { Webhook } from "minimal-discord-webhook-node";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const requestedURL: URL = new URL(request.url);
    if (requestedURL.pathname == "/")
      await this.scheduled(null, env, ctx);
    return new Response("Hello");
  },
  async scheduled(_event: ScheduledEvent|null, env: Env, ctx: ExecutionContext) {
    if (isEmpty(env.TARGET)) {
      console.warn("The target post url is empty, die.");
      return;
    }

    const hasWebhook: boolean = !isEmpty(env.WEBHOOK);
    const maxGalleryImages: number = Number(env.MAX_GALLERY_IMAGES);
    const discordWebhook: Webhook|null = hasWebhook ? new Webhook({url: env.WEBHOOK, throwErrors: false, retryOnLimit: true}) : null;

    const allRecords = await fetch(`https://constellation.microcosm.blue/links?target=${encodeURIComponent(env.TARGET)}&collection=app.bsky.feed.post&path=.reply.parent.uri`, {
      headers: {"Accept": "application/json"}
    });
    if (allRecords.ok) {
      const jsonInfo: ATRecordBlob = await allRecords.json();
      const previousRecord: LandmarkData|null = await env.KV.get("landmark", "json");
      const totalRecords = jsonInfo.total;
      // I have no records oh god help me please
      if (previousRecord === null || previousRecord.total <= totalRecords || previousRecord.cursor != jsonInfo.cursor) {
        // check number of records
        if (jsonInfo.linking_records.length > 0) {
          const firstRKey:string = jsonInfo.linking_records[0].rkey;
          // check to see if any records are different
          if (previousRecord !== null && firstRKey == previousRecord.last_top_record) {
            console.log("No new changes");
            return;
          }
          for (const record of jsonInfo.linking_records) {
            // skip any messages that are written by me
            if (record.did === env.SKIP_DID)
              continue;

            const recordExists:string|null = await env.KV.get(record.rkey);
            if (recordExists !== null) {
              break;
            }
            // We have never seen this object in our life, ever.
            // I know this, and I love you.

            // Create the FX URL
            const fxURL = `https://fxbsky.app/profile/${record.did}/post/${record.rkey}`;

            // BIG TIME RUSH FETCH RECORD
            const bskyRecord = await fetch(`https://public.api.bsky.app/xrpc/com.atproto.repo.getRecord?collection=app.bsky.feed.post&repo=${record.did}&rkey=${record.rkey}`);
            if (bskyRecord.ok) {
              const bskyRecordJson: AppBskyFeedPost.Main = (await bskyRecord.json() as RawRecord).value;
              const mediaType: string = bskyRecordJson.embed?.$type || "";
              // Try to grab images
              if (mediaType === "app.bsky.embed.images") {
                const imgSchema: AppBskyEmbedImages.Main = (bskyRecordJson.embed! as AppBskyEmbedImages.Main);
                for (const embedData of imgSchema.images) {
                  // Grab a bunch of info for the image
                  const blob: Blob<string> = embedData.image as Blob<string>;
                  const blobID: string = (blob.ref as CidLink).$link;
                  const mimeType: string = embedData.image.mimeType;
                  await parseAndUploadToR2(env, record.did, blobID, mimeType, embedData.alt, embedData.aspectRatio);
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
                    if (await parseAndUploadToR2(env, record.did, blobID, mimeType, embedData.alt, embedData.aspectRatio))
                      ++count;
                 }
              // Copy any external thumbnails and save those too
              } else if (mediaType === "app.bsky.embed.external") {
                const externalData: AppBskyEmbedExternal.External = (bskyRecordJson.embed! as unknown as AppBskyEmbedExternal.External);
                const thumbData: Blob<string>|undefined = externalData.thumb as Blob<string>|undefined;
                if (thumbData !== undefined) {
                  await parseAndUploadToR2(env, record.did, thumbData.ref.$link, thumbData.mimeType);
                }
              // This is a quote post, just let it go to something...
              // I don't know if it makes sense to error on links with no thumbs...
              } else if (mediaType === "app.bsky.embed.record") {
                // Don't do anything here, because we do want to save this record
              } else {
                console.log("NO IMAGE BASED DATA FOUND, SKIPPING");
                continue;
              }
              // Valid records get stored and pushed to discord
              await env.KV.put(record.rkey, fxURL);
              if (hasWebhook)
                ctx.waitUntil(discordWebhook.send(fxURL));

              console.log(`Successfully processed ${record.rkey}!`);
            } else {
              console.error(`We couldn't fetch the record for ${fxURL}`);
              continue;
            }
          }
          console.log(`New Landmark record created ${firstRKey}`);
          await env.KV.put("landmark", JSON.stringify({cursor: jsonInfo.cursor, total: jsonInfo.total, last_top_record: firstRKey} as LandmarkData));
        } else {
          console.log("NO RECORDS EXIST, LMAO");
        }
      } else {
        console.log("detected no changes in record");
      }
    } else {
      console.warn(`Unable to get current bsky records, got return of "${allRecords.statusText}"`);
    }
  }
};

async function parseAndUploadToR2(env: Env, user: string, blobID: string, mimeType: string, alt: string|undefined=undefined, aspectRatio:ImgAspectRatio|undefined=undefined): Promise<boolean> {
  const blobURL: string = `https://cdn.bsky.app/img/download/plain/${user}/${blobID}`;
  // Try to load it into memory
  const bigBlobRush = await fetch(blobURL, {headers: {"Content-Type": mimeType} });
  if (bigBlobRush.ok) {
    // dump it on R2
    const metadataHold: CustomR2Metadata = {
      "user": user,
      "type": mimeType,
      "width": (aspectRatio?.width || 0).toString(),
      "alt": alt ?? "",
      "height": (aspectRatio?.height || 0).toString()
    };
    await env.R2.put(`${user}/${uuidv4()}.${mime.getExtension(mimeType)}`, await bigBlobRush.blob(), {
      customMetadata: metadataHold
    });
    return true;
  } else {
    console.warn(`unable to save blob from user ${user} got error "${bigBlobRush.statusText}"`);
    return false;
  }
}