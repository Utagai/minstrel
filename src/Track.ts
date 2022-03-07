import Album from './Album';

type Track = {
  spotifyID: string;
  durationMillis: number;
  isExplicit: boolean;
  name: string;
  isLocal: boolean | null;
  previewURL: string | null;
  popularity: number;
  // NOTE: Ideally, we wouldn't need to do this embedding here, however, the
  // Spotify API wrapper we use doesn't include the album IDs in the recently
  // played response (even though it should, as per Spotify's Web API
  // reference). If we don't do this, we have to pay for an extra API call to
  // get album info, which we'd rather avoid. There are ways to avoid the extra
  // API call and also avoid this embedding, but it involves making the code
  // even uglier but in a different place. The net negative of embedding seems
  // the lowest.
  album: Album;
};

export default Track;
