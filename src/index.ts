/**
 * This example is using the Authorization Code flow.
 *
 * In root directory run
 *
 *     npm install express
 *
 * then run with the followinng command. If you don't have a client_id and client_secret yet,
 * create an application on Create an application here: https://developer.spotify.com/my-applications to get them.
 * Make sure you whitelist the correct redirectUri in line 26.
 *
 *     node access-token-server.js "<Client ID>" "<Client Secret>"
 *
 *  and visit <http://localhost:8888/login> in your Browser.
 */

import SpotifyWebApi from 'spotify-web-api-node';
import express from 'express';

import { applyEnvVars } from './Environment';

applyEnvVars();

const scopes = [
  'user-read-currently-playing',
  'user-read-email',
  'user-read-private',
  'user-read-recently-played',
];

const spotifyAPI = new SpotifyWebApi({
  redirectUri: 'http://localhost:8888/callback',
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

const generateRandomString = (length: number) => {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const app = express();

app.get('/login', (_, res) => {
  res.redirect(spotifyAPI.createAuthorizeURL(scopes, generateRandomString(16)));
});

app.get('/info', (_, res) => {
  spotifyAPI
    .getMyRecentlyPlayedTracks({ limit: 3 })
    .then((data) => {
      res.json(data.body);
    })
    .catch((err) => {
      res.send(`encountered an err: ${err}`);
    });
});

app.get('/callback', (req, res) => {
  const { code, error } = req.query;
  // const state = req.query.state;

  if (error) {
    console.error('Callback Error:', error);
    res.send(`Callback Error: ${error}`);
    return;
  }

  spotifyAPI
    .authorizationCodeGrant(code!.toString())
    .then((data) => {
      const accessToken = data.body.access_token;
      const refreshToken = data.body.refresh_token;
      const expiresIn = data.body.expires_in;

      spotifyAPI.setAccessToken(accessToken);
      spotifyAPI.setRefreshToken(refreshToken);

      console.log('access_token:', accessToken);
      console.log('refresh_token:', refreshToken);

      console.log(
        `Sucessfully retreived access token. Expires in ${expiresIn} s.`,
      );
      res.send('Success! You can now close the window.');

      setInterval(async () => {
        const refreshData = await spotifyAPI.refreshAccessToken();
        const refreshedAccessToken = refreshData.body.access_token;

        console.log('The access token has been refreshed!');
        console.log('access_token:', refreshedAccessToken);
        spotifyAPI.setAccessToken(refreshedAccessToken);
      }, (expiresIn / 2) * 1000);
    })
    .catch((err) => {
      console.error('Error getting Tokens:', err);
      res.send(`Error getting Tokens: ${err}`);
    });
});

app.listen(8888, () =>
  console.log(
    'HTTP Server up. Now go to http://localhost:8888/login in your browser.',
  ),
);
