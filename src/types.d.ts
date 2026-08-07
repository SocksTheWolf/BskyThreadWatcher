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
  width: string;
  height: string;
  alt?: string;
};

interface RawRecord {
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

type DIDLookupResult = DIDLookupFailure|DIDLookupSuccess;