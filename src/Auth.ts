import SpotifyWebApi from 'spotify-web-api-node';
import express from 'express';

const generateRandomString = (length: number) => {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

export function authorizeSpotifyAPI(
  spotifyAPI: SpotifyWebApi,
  scopes: string[],
): Promise<void> {
  const app = express();

  app.get('/login', (_, res) => {
    res.redirect(
      spotifyAPI.createAuthorizeURL(scopes, generateRandomString(16)),
    );
  });

  const p = new Promise<void>((resolve, reject) => {
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
          resolve();
        })
        .catch((err) => {
          const errMsg = `Error getting Tokens: ${err}`;
          console.error(errMsg);
          res.send(errMsg);
          reject(err);
        });
    });
  });

  app.listen(8888, () =>
    console.log(
      'HTTP Server up. Now go to http://localhost:8888/login in your browser.',
    ),
  );

  return p;
}

export default authorizeSpotifyAPI;
