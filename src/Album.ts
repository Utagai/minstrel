type Album = {
  spotifyID: string;
  name: string;
  releaseDate: Date;
  // NOTE: No reason to try to maintain an accurate list. Easier and just as
  // effective to just encode as a string rather than enum.
  type: string;
  trackCount: number;
  imageURL: string;
};

export default Album;
