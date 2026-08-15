import isEmpty from "just-is-empty";
import { getRecordFeed } from "../consts";
import { lookupName } from "../services/bskyNameLookup";
import type { ParseThreadData } from "../types";

export async function parseThread(env: Env, ctx: ExecutionContext, thread: string, data: ParseThreadData) {
  const allRecords = await fetch(getRecordFeed(thread), {
    headers: {"Accept": "application/json"}
  });
  if (allRecords.ok) {
    const jsonInfo: ATRecordBlob = await allRecords.json<ATRecordBlob>();
    const totalRecords = jsonInfo.total;

    // this can never be a string return, only null or data.
    const previousRecord: LandmarkData|null = data.threadData.get(thread) as LandmarkData|null;

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

        // @ts-expect-error - "true"/"false" type overlap due to how wrangler generates types
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!isEmpty(env.WEBHOOK) && env.POST_RECORD_FINDINGS === "true" && data.webhook !== null)
          ctx.waitUntil(data.webhook.send(`Found ${recordDelta} new records`));

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

          // We have never seen this object in our life, ever.
          // "I know this, and I love you."
          const newRecordTask: BSkyRecordTask = {
            recordNumber: data.current_total + 1,
            username: await lookupName(record.did),
            did: record.did,
            rkey: record.rkey,
            recurseDepth: 0
          };

          // push to the queue
          await env.THREAD_UPDATE_QUEUE.send(newRecordTask, {contentType: 'v8'})
          ++data.current_total;
        }
        // Save the last location that we were at
        console.log(`New Landmark record created ${firstRKey}! Processed ${recordDelta} records`);
        const updatedKVRecord: LandmarkData = {
          cursor: jsonInfo.cursor,
          total: jsonInfo.total,
          last_top_record: firstRKey
        };
        await env.KV.put(thread, JSON.stringify(updatedKVRecord));
      } else {
        console.warn("NO RECORDS EXIST.");
      }
    } else {
      console.log("detected no changes in record");
    }
  } else {
    console.warn(`Unable to get current bsky records, got return: "${allRecords.statusText}"`);
  }
}
