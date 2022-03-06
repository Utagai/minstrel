import SpotifyWebApi from 'spotify-web-api-node';

import { applyEnvVars } from './Environment';
import authorizeSpotifyClient from './Auth';

applyEnvVars();

const scopes = [
  'user-read-currently-playing',
  'user-read-email',
  'user-read-private',
  'user-read-recently-played',
];

async function main() {
  const spotifyAPI = new SpotifyWebApi({
    redirectUri: 'http://localhost:8888/callback',
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  });

  await authorizeSpotifyClient(spotifyAPI, scopes);

  spotifyAPI
    .getMyRecentlyPlayedTracks({ limit: 3 })
    .then((data) => {
      console.log(data);
    })
    .catch((err) => {
      console.log(`encountered an err: ${err}`);
    });
}

main();
