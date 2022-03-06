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

  spotify.API.getMyRecentlyPlayedTracks({ limit: 3 })
    .then((data) => {
      console.log(data);
    })
    .catch((err) => {
      console.log(`encountered an err: ${err}`);
    });
}

main();
