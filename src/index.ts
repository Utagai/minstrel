import Pino, { Logger } from 'pino';

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
  const logger = Pino();
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
  await loop(logger, spotify, inserter);
}

async function loop(
  logger: Logger,
  spotify: Spotify,
  inserter: Inserter,
): Promise<void> {
  // 10 minutes in milliseconds. The idea being that Spotify can only give us
  // at most the 50 most recently played tracks. For us to _lose_ information, a
  // user must successfully play more than 50 songs from start to finish in 10
  // minutes. This means they are listening to songs that are at most 12 seconds
  // long. This seems rather unlikely so we stick with 10 minutes as a safe bet,
  // as this should be fast enough to never miss a song.
  const periodicityMinutes = 10;
  const periodicityMillis = 1000 * 60 * periodicityMinutes; // periodicityMinutes in milliseconds.

  await run(logger, spotify, inserter).catch((err) => {
    logger.error({ err }, 'failed a minstrel run');
  });

  // We want this loop to execute synchronously & periodically.
  setTimeout(() => loop(logger, spotify, inserter), periodicityMillis);
}

async function run(
  logger: Logger,
  spotify: Spotify,
  inserter: Inserter,
): Promise<void> {
  const latestEventTS = await inserter.getLatestEventTimestamp();
  logger.info({ msg: 'fetching listen data', latestEventTS });

  const getRecentlyPlayed = async () =>
    spotify.getRecentlyPlayed(latestEventTS).then((data) => {
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
              logger.error(
                {
                  err: loadRes.error,
                  stmt: loadRes.stmt,
                  event: loadRes.event,
                },
                'failed to insert individual listen event',
              );
            }
          });
          logger.info('inserted all listen data');
        })
        .catch((err) => {
          logger.error({ err }, 'failed to insert listen data');
        });
    });

  return wrapWithRetry(logger, 'getRecentlyPlayed', getRecentlyPlayed);
}

async function wrapWithRetry<T>(
  logger: Logger,
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
    return retry(logger, op, pFunc, 0);
  });
}

// NOTE: Setting these values is a bit tricky...
// This program is fundamentally a bit brittle. This is because
// Spotify limits our ability to get past listening data for >50
// tracks. We set the periodicity of collection to be 10 minutes, and
// assume that this is the safe periodicity to make sure we don't miss
// any songs. The rough reasoning for this choice being that there is
// no way a user could possibly listen to 50 songs start to finish
// before 10 minutes is up. This is a pretty reasonable assumption and
// it _should work_...
//
// Of course, it isn't that simple, namely due to retry behavior. To
// see this, imagine that we trigger a collection of listen data on
// the 10th minute. Then, we keep retrying for e.g. 5 minutes before
// finally passing. If we do this, by the time we finish our work,
// we'll then proceed to wait 10 more minutes. However, from the last
// collection event, we waited a total of _15_ minutes! This is
// technically, according to our assumption from before, enough time
// for a user to listen to >50 songs.
//
// Visually, you can see the error case via this timeline:
//
//
//
//        ┌───────────────── >10m! ──────────────────┐
//        │                                          │
//  0m
// <|─────|───────────────|──────────────────────────|────────────>
//        |               |                          |
//        10m             |                          |
//   1st collection       |                          |
//                       ~15m                        |
//                Retries finally end                |
//                Wait 10m for 2nd collection        |
//                                                  25m
//                                2nd collection starts
//                                But this is >10m since the 1st!
//
//
// It is technically possible to fix this to _some_ degree. One can
// make the wait time between collection events variable depending on
// how long it took to finish the prior collection, but this still
// caps our maximum retry window to the periodicity. Additionally, the
// Spotify API takes after & before parameters to their call, and it
// may be possible to incrementally tighten the interval we query
// until we find a result with a size <50. Once we find this, we can
// insert those elements, and then consider this tightened interval
// processed, and repeat this process for the remainder of the
// original interval. For example:
//
//   1. Try to get events from ts=0 to te=10 (ts = t-start, te=t-end).
//   2. The number of events here was >=50, therefore, we may have
//      missed some events.
//   3. Tighten the interval to ts=0 to te=5.
//   4. The number of events here is still >=50, therefore we may have
//      missed some events.
//   6. Further tighten the interval to ts=0 to te=2.5.
//   7. The number of events here is <50! We have all the
//      events. Process & insert them.
//   8. Now the remaining interval to process is ts=2.5 to
//      te=10. Repeat from step 1 with ts=2.5 & te=10.
//
// As you can imagine, this is significantly more complex to implement.
//
// I've elected to not expend effort in implementing this, because I
// expect retries to not take up that much time, and additionally,
// since this service's function is to aggregate large amounts of
// data, a few missing songs, even the missing of an entire batch's
// worth (50) is not going to have a big impact at all.
const maxRetries = 10;
const retryDelayMS = 30 * 1000; // 30 seconds.

async function retry<T>(
  logger: Logger,
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
            resolve(retry(logger, op, pFunc, numRetries + 1));
          }
        });
    }, retryDelayMS);
  });
}

main();
