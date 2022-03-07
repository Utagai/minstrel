import util from 'util';

import { applyEnvVars } from './Environment';
import Spotify from './Spotify';

applyEnvVars();

const scopes = [
  'user-read-currently-playing',
  'user-read-email',
  'user-read-private',
  'user-read-recently-played',
];

async function main() {
  const spotify = new Spotify(
    process.env.SPOTIFY_CLIENT_ID!,
    process.env.SPOTIFY_CLIENT_SECRET!,
    scopes,
  );

  await spotify.authorize();

  spotify
    .getRecentlyPlayed()
    .then((data) => {
      console.log(util.inspect(data, false, null, true));
    })
    .catch((err) => {
      console.log(`encountered an err: ${err}`);
    });
}

main();
