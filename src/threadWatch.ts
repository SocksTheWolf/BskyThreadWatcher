import has from "just-has";
// @ts-ignore
import { Webhook } from "minimal-discord-webhook-node";
import { scrapeBSkyRecord } from "./scrapeRecord";
import { getFXURL, getRecordFeed } from "./urls";
import isEmpty from "just-is-empty";

export async function checkThreadForUpdates(env: Env, ctx: ExecutionContext, thread: string) {
  // Thread is empty, die.
  if (isEmpty(thread)) {
    return;
  }

  const hasWebhook: boolean = !isEmpty(env.WEBHOOK);
  const discordWebhook: Webhook|null = hasWebhook ? new Webhook({url: env.WEBHOOK, throwErrors: false, retryOnLimit: true}) : null;

  let newRecords: number;
  const allRecords = await fetch(getRecordFeed(env.TARGET), {
    headers: {"Accept": "application/json"}
  });
  if (allRecords.ok) {
    const jsonInfo: ATRecordBlob = await allRecords.json<ATRecordBlob>();
    const previousRecord: LandmarkData|null = await env.KV.get("landmark", "json");
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
        newRecords = previousRecordCount +1;

        if (hasWebhook)
          ctx.waitUntil(discordWebhook.send(`Found ${recordDelta} new records`));

        // Go until we find a record we've already processed.
        for (const record of jsonInfo.linking_records) {
          // skip any messages that are written by me
          if (record.did === env.SKIP_DID)
            continue;

          // check if we have reviewed this record before
          const recordExists: string|null = await env.KV.get(record.rkey);
          if (recordExists !== null) {
            break;
          }

          // Get the username
          let username: string = record.did;
          const usernameFetch = await fetch(`https://plc.directory/${record.did}`);
          if (usernameFetch.ok) {
            const rawUserFetch = await usernameFetch.json<DIDLookupResult>();
            // Unnecessary, but safe anyways. Message is an error.
            if (!has(rawUserFetch, "message")) {
              const aliases = (rawUserFetch as DIDLookupSuccess).alsoKnownAs;
              for (const alias of aliases) {
                if (alias.includes("at://")) {
                  username = alias.replace("at://", "");
                  break;
                }
              }
            }
          } else {
            console.warn(`Could not resolve username for ${record.did}`);
          }

          // We have never seen this object in our life, ever.
          // "I know this, and I love you."
          const data: BSkyRecordTask = {
            recordNumber: newRecords,
            username: username,
            did: record.did,
            rkey: record.rkey,
            recurseDepth: 0
          };

          if (await scrapeBSkyRecord(env, data)) {
            const fxURL = getFXURL(record.did, record.rkey);

            // Valid records get stored and pushed to discord
            await env.KV.put(record.rkey, fxURL);

            // spin up a task to push to discord webhook later.
            if (hasWebhook)
              ctx.waitUntil(discordWebhook.send(fxURL));

            console.log(`Successfully processed ${record.rkey}!`);
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
        await env.KV.put("landmark", JSON.stringify(updatedKVRecord));
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
