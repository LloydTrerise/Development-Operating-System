export interface StoredArtifactContent {
  uri: string;
  hash: string;
}

export interface ArtifactStorage {
  put: (content: string, contentType: string) => Promise<StoredArtifactContent>;
  get: (uri: string) => Promise<string>;
}
