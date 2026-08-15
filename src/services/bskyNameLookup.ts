import has from "just-has";
import { usernameLookup } from "../consts";

export async function lookupName(did: string): Promise<string> {
  const usernameFetch = await fetch(usernameLookup(did));
  if (usernameFetch.ok) {
    const rawUserFetch = await usernameFetch.json<DIDLookupResult>();
    // Unnecessary, but safe anyways. Message is an error.
    if (!has(rawUserFetch, "message")) {
      const aliases = (rawUserFetch as DIDLookupSuccess).alsoKnownAs;
      for (const alias of aliases) {
        if (alias.includes("at://")) {
          return alias.replace("at://", "");
        }
      }
    }
  }
  return did;
}