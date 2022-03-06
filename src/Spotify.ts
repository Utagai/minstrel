import SpotifyWebApi from 'spotify-web-api-node';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const redirectURI = 'http://localhost:8888/callback';

class Spotify {
  API: SpotifyWebApi;

  #scopes: string[];

  constructor(clientID: string, clientSecret: string, scopes: string[]) {
    this.API = new SpotifyWebApi({
      redirectUri: redirectURI,
      clientId: clientID,
      clientSecret,
    });
    this.#scopes = scopes;
  }

  async authorize(): Promise<void> {
    const app = express();

    app.get('/login', (_, res) => {
      res.redirect(this.API.createAuthorizeURL(this.#scopes, uuidv4()));
    });

    const p = new Promise<void>((resolve, reject) => {
      app.get('/callback', (req, res) => {
        const { code, error } = req.query;

        if (error) {
          console.error('Callback Error:', error);
          res.json({ error });
          return;
        }

        this.API.authorizationCodeGrant(code!.toString())
          .then((data) => {
            const accessToken = data.body.access_token;
            const refreshToken = data.body.refresh_token;
            const expiresIn = data.body.expires_in;

            this.API.setAccessToken(accessToken);
            this.API.setRefreshToken(refreshToken);

            console.log(
              `Sucessfully retreived access token. Expires in ${expiresIn} s.`,
            );
            res.json({ msg: 'Success. You can close this window.' });

            setInterval(async () => {
              const refreshData = await this.API.refreshAccessToken();
              const refreshedAccessToken = refreshData.body.access_token;

              console.log('The access token has been refreshed!');
              this.API.setAccessToken(refreshedAccessToken);
            }, (expiresIn / 2) * 1000);
            resolve();
          })
          .catch((err) => {
            const errMsg = `Error getting Tokens: ${err}`;
            res.json({ err: errMsg });
            reject(err);
          });
      });
    });

    const server = app.listen(8888, () =>
      console.log(
        'HTTP Server up. Now go to http://localhost:8888/login in your browser.',
      ),
    );

    return p.then(() => {
      // Remember to shut down express, now that we no longer need it for the
      // OAuth flow.
      console.log('Authenticated. HTTP server going down.');
      server.close();
    });
  }
}

export default Spotify;
