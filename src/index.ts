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

// TODO: Don't make this a global.
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
  await loop(spotify, inserter);
}

async function loop(spotify: Spotify, inserter: Inserter): Promise<void> {
  // 10 minutes in milliseconds. The idea being that Spotify can only give us
  // at most the 50 most recently played tracks. For us to _lose_ information, a
  // user must successfully play more than 50 songs from start to finish in 10
  // minutes. This means they are listening to songs that are at most 12 seconds
  // long. This seems rather unlikely so we stick with 10 minutes as a safe bet,
  // as this should be fast enough to never miss a song.
  const periodicityMinutes = 10;
  const periodicityMillis = 1000 * 60 * periodicityMinutes; // periodicityMinutes in milliseconds.

  await run(spotify, inserter).catch((err) => {
    logger.error({ err }, 'failed a minstrel run');
  });

  // We want this loop to execute synchronously & periodically.
  setTimeout(() => loop(spotify, inserter), periodicityMillis);
}

async function run(spotify: Spotify, inserter: Inserter): Promise<void> {
  const latestEventTS = await inserter.getLatestEventTimestamp();
  logger.info({ msg: 'fetching listen data', latestEventTS });

  const getRecentlyPlayed = async () => {
    return spotify.getRecentlyPlayed(latestEventTS).then((data) => {
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
          logger.info('inserted all listen data');
        })
        .catch((err) => {
          logger.error({ msg: 'failed to insert listen data', err });
        });
    });
  };

  return wrapWithRetry('getRecentlyPlayed', getRecentlyPlayed);
}

async function wrapWithRetry<T>(
  op: string,
  pFunc: () => Promise<T>,
): Promise<T> {
  return pFunc().catch((err) => {
    logger.warn(
      {
        op,
        err,
      },
      'failed to execute operation, entering retry loop',
    );
    return retry(op, pFunc, 0);
  });
}

// TODO: Update post-debugging.
const maxRetries = 3;
const retryDelayMS = 5 * 1000; // 30 seconds.

async function retry<T>(
  op: string,
  pFunc: () => Promise<T>,
  numRetries: number,
): Promise<T> {
  const retryLogger = logger.child({
    op,
    numRetries,
    maxRetries,
    retryDelayMS,
  });

  retryLogger.warn({
    msg: 'retrying operation',
  });

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      pFunc()
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          retryLogger.warn(
            { err, numTries: numRetries + 1 },
            'operation failed, retrying',
          );

          if (numRetries + 1 >= maxRetries) {
            retryLogger.error(
              { err, maxRetries },
              'operation failed maximum number of times',
            );

            reject(
              new Error(
                `failed to successfully complete operation ${op} after ${maxRetries} attempts: ${err}`,
              ),
            );
          } else {
            resolve(retry(op, pFunc, numRetries + 1));
          }
        });
    }, retryDelayMS);
  });
}

main();
