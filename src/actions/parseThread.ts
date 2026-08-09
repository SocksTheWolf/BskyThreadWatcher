import isEmpty from "just-is-empty";
import type { DiscordWebhook } from "../services/discord";
import { getRecordFeed, usernameLookup } from "../urls";

export async function parseThreadUpdates(env: Env, ctx: ExecutionContext, thread: string, discordWebhook: DiscordWebhook=null) {
  const allRecords = await fetch(getRecordFeed(thread), {
    headers: {"Accept": "application/json"}
  });
  if (allRecords.ok) {
    const jsonInfo: ATRecordBlob = await allRecords.json<ATRecordBlob>();
    const previousRecord: LandmarkData|null = await env.KV.get(thread, "json");
    const globalTotalStr: string|null = await env.KV.get("global_total", "text");
    const globalTotal: number = globalTotalStr !== null ? Number(globalTotalStr) : 0;
    const totalRecords = jsonInfo.total;
    // I have no records oh god help me please
    if (previousRecord === null || previousRecord.total <= totalRecords || previousRecord.cursor != jsonInfo.cursor) {
      // check number of records in this new swarm
      if (jsonInfo.linking_records.length > 0) {
        // get the first record for comparison
        const firstRKey: string = jsonInfo.linking_records[0].rkey;
        // check to see if any records are different
        if (previousRecord !== null && firstRKey == previousRecord.last_top_record) {
          console.log("No new changes");
          return;
        }
        const previousRecordCount = (previousRecord?.total ?? 0);
        const recordDelta = totalRecords - previousRecordCount;
        let newRecords: number = globalTotal + 1;

        // @ts-expect-error - "true"/"false" type overlap
        if (!isEmpty(env.WEBHOOK) && env.POST_RECORD_FINDINGS === "true")
          ctx.waitUntil(discordWebhook?.send(`Found ${recordDelta} new records`));

        // Go until we find a record we've already processed.
        for (const record of jsonInfo.linking_records) {
          // skip any messages that are written by me
          if (record.did === env.SKIP_DID)
            continue;

          // check if we have reviewed this record before
          const recordExists: string|null = await env.KV.get(record.rkey);
          if (recordExists !== null) {
            console.log(`record ${record.rkey} exists, breaking out`);
            break;
          }

          // Get the username
          const username: string = await usernameLookup(record.did);

          // We have never seen this object in our life, ever.
          // "I know this, and I love you."
          const data: BSkyRecordTask = {
            recordNumber: newRecords,
            username: username,
            did: record.did,
            rkey: record.rkey,
            recurseDepth: 0
          };

          if (await env.THREAD_UPDATE_QUEUE?.send(data, {contentType: 'v8'})) {
            ++newRecords;
          } else {
            console.warn(`failed to process ${record.rkey}, skipped`);
          }
        }
        // Save the last location that we were at
        console.log(`New Landmark record created ${firstRKey}! Processed ${recordDelta} records`);
        const updatedKVRecord: LandmarkData = {
          cursor: jsonInfo.cursor,
          total: jsonInfo.total,
          last_top_record: firstRKey
        };
        await env.KV.put(thread, JSON.stringify(updatedKVRecord));
        // also put the global total in across all threads.
        await env.KV.put("global_total", newRecords.toString());
      } else {
        console.log("NO RECORDS EXIST, OH DA MISERY.");
      }
    } else {
      console.log("detected no changes in record");
    }
  } else {
    console.warn(`Unable to get current bsky records, got return: "${allRecords.statusText}"`);
  }
}
