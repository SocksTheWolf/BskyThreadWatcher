interface ATRecord {
  did: string;
  collection: "app.bsky.feed.post";
  rkey: string
};

interface ATRecordBlob {
  cursor: string;
  total: number;
  linking_records: ATRecord[]
};

interface LandmarkData {
  cursor: string;
  total: number;
  last_top_record: string;
};

interface ImgAspectRatio {
  width: number;
  height: number;
};

interface CustomR2Metadata extends Record<string, string> {
  user: string;
  type: string;
  width?: string;
  height?: string;
  alt?: string;
};

interface RawRecord {
  uri: string;
  cid: string;
  value: AppBskyFeedPost.Main
};

interface DIDLookupSuccess {
  id: string;
  alsoKnownAs: string[];
  verificationMethod: unknown;
  serviceMethod: unknown;
};

interface DIDLookupFailure {
  message: string;
};

interface BSkyRecordTask {
  recordNumber: number;
  username: string;
  did: string;
  rkey: string;
  thread: string;
  // filled in by scrapeBSkyRecord
  uri?: string;
  cid?: string;
  // way to stop infinite recursion
  recurseDepth: number;
};

interface AtProtoAgentLoginOptions {
  identifier: string;
  password: string;
};

type R2Types = ReadableStream | ArrayBuffer | ArrayBufferView | string | null;
type DIDLookupResult = DIDLookupFailure|DIDLookupSuccess;
type KVThreadReturnResult = Map<string, LandmarkData|null|string>;