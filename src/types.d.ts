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
}