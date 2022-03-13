import util from 'util';

import { applyEnvVars } from './Environment';
import Spotify from './Spotify';
import Inserter from './Inserter';

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
  const inserter = new Inserter();

  await spotify.authorize();

  spotify
    .getRecentlyPlayed()
    .then((data) => {
      console.log(util.inspect(data, false, null, true));
      inserter.insert(data).then((res) => {
        res.forEach((loadRes) => {
          console.log(
            `${loadRes.stmt}
              ${loadRes.success ? '✅' : `❌${loadRes.error}`}
            =======`,
          );
        });
      });
    })
    .catch((err) => {
      console.log(`encountered an err: ${err}`);
    });
}

main();
