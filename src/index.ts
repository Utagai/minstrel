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
  await spotify.authorize();
  const inserter = new Inserter();

  loop(spotify, inserter);
}

async function loop(spotify: Spotify, inserter: Inserter) {
  // 10 minutes in milliseconds. The idea being that Spotify can only give us
  // at most the 50 most recently played tracks. For us to _lose_ information, a
  // user must successfully play more than 50 songs from start to finish in 10
  // minutes. This means they are listening to songs that are at most 12 seconds
  // long. This seems rather unlikely so we stick with 10 minutes as a safe bet,
  // as this should be fast enough to never miss a song.
  const periodicityMinutes = 10;
  const periodicityMillis = 1000 * 60 * periodicityMinutes; // periodicityMinutes in milliseconds.

  run(spotify, inserter);

  // We want this loop to execute synchronously & periodically.
  setTimeout(() => loop(spotify, inserter), periodicityMillis);
}

async function run(spotify: Spotify, inserter: Inserter) {
  const latestEventTS = await inserter.getLatestEventTimestamp();
  console.log(`Latest event TS: ${latestEventTS}`);

  spotify
    .getRecentlyPlayed(latestEventTS)
    .then((data) => {
      console.log(util.inspect(data, false, null, true));
      console.log(`================%%%%%=============`);
      inserter.insert(data).then((res) => {
        res.forEach((loadRes) => {
          console.log(`${loadRes.success ? '✅' : `❌${loadRes.error}`}`);
        });
      });
    })
    .catch((err) => {
      console.log(`encountered an err: ${err}`);
    });
}

main();
