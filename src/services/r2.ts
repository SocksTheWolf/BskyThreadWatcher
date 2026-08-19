import mime from 'mime/lite';
import { v4 as uuidv4 } from 'uuid';

async function rawUploadToR2(env: Env, count: number, user: string, fileName: string,
  data: R2Types, metaData?: CustomR2Metadata): Promise<R2Object|null>
{
  try {
    const entryNumber: string = count.toString().padStart(3, "0");
    return await env.R2.put(`${entryNumber} - ${user}/${fileName}`, data, {
      customMetadata: metaData,
      httpMetadata: {
        contentType: metaData?.type
      }
    });
  } catch (ex) {
    console.error(`Failed to upload to R2, got: ` + String(ex));
  }
  return null;
}

export async function saveRecordText(env: Env, data: BSkyRecordTask, text: string) {
  const metaTextData: CustomR2Metadata = {
      "user": data.username,
      "type": "text/plain",
    };
    await rawUploadToR2(env, data.recordNumber, data.username, "post.txt", text, metaTextData);
}

export async function fetchImageAndUpload(env: Env, data: BSkyRecordTask, blobID: string, mimeType: string,
    alt?: string, aspectRatio?:ImgAspectRatio): Promise<boolean>
{
  const blobURL: string = `https://cdn.bsky.app/img/download/plain/${data.did}/${blobID}`;
  // Try to load it into memory
  const bigBlobRush = await fetch(blobURL, {
    headers: { "Content-Type": mimeType, "User-Agent": env.USER_AGENT }
  });

  if (bigBlobRush.ok) {
    // dump it on R2
    const metadataHold: CustomR2Metadata = {
      "user": data.username,
      "type": mimeType,
      "width": (aspectRatio?.width || 0).toString(),
      "alt": alt ?? "",
      "height": (aspectRatio?.height || 0).toString()
    };
    const uploadRes = await rawUploadToR2(env, data.recordNumber, data.username,
      `${uuidv4()}.${mime.getExtension(mimeType) ?? "any"}`,
      await bigBlobRush.bytes(), metadataHold);
    return uploadRes !== null;
  } else {
    console.warn(`unable to save blob from user ${data.username} got error "${bigBlobRush.statusText}"`);
  }
  return false;
}