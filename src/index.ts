import util from 'util';

import Pino from 'pino';

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

const logger = Pino();

async function main() {
  const spotify = new Spotify(
    {
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      accessToken: process.env.SPOTIFY_ACCESS_TOKEN,
      refreshToken: process.env.SPOTIFY_REFRESH_TOKEN,
      scopes,
    },
    logger,
  );
  await spotify.authorize();
  logger.info('authorized');
  const inserter = new Inserter();

  logger.info('beginning stalk loop');
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
  logger.info({ msg: 'fetching listen data', latestEventTS });

  spotify
    .getRecentlyPlayed(latestEventTS)
    .then((data) => {
      logger.info({
        msg: 'got recently played data',
        numTracks: data.length,
        data,
      });
      inserter
        .insert(data)
        .then((res) => {
          res.forEach((loadRes) => {
            if (!loadRes.success) {
              logger.error({
                msg: 'failed to insert individual listen event',
                err: loadRes.error,
              });
            }
          });
        })
        .catch((err) => {
          logger.error({ msg: 'failed to insert listen data', err });
        });
    })
    .catch((err) => {
      logger.error({ msg: 'failed to get recently played tracks', err });
    });
}

main();
