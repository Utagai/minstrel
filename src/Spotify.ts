import SpotifyWebApi from 'spotify-web-api-node';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { parse, parseJSON, getUnixTime } from 'date-fns';
import open from 'open';

import Event from './Event';
import Track from './Track';
import Artist from './Artist';

const redirectURI = 'http://localhost:8888/callback';

type SpotifyCreds = {
  clientId: string;
  clientSecret: string;
  scopes: string[];

  accessToken?: string;
  refreshToken?: string;
};

class Spotify {
  API: SpotifyWebApi;

  private scopes: string[];

  constructor(creds: SpotifyCreds) {
    this.API = new SpotifyWebApi();
    this.API.setCredentials(creds);
    this.API.setRedirectURI(redirectURI);
    this.scopes = creds.scopes;
  }

  async authorize(): Promise<void> {
    const creds = this.API.getCredentials();
    const needsServerAuthFlow =
      creds.accessToken !== undefined && creds.refreshToken !== undefined;

    if (needsServerAuthFlow) {
      console.log(
        'Found access & refresh tokens, skipping server authentication flow',
      );
      const defaultExpireDuration = 3600;
      this.startRefreshLoop(defaultExpireDuration);
      return;
    } else {
      return this.startServerAuthFlow();
    }
  }

  private async startServerAuthFlow(): Promise<void> {
    const app = express();

    app.get('/login', (_, res) => {
      res.redirect(this.API.createAuthorizeURL(this.scopes, uuidv4()));
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
            const expireDuration = data.body.expires_in;

            this.API.setAccessToken(accessToken);
            this.API.setRefreshToken(refreshToken);

            console.log(
              `Sucessfully retreived access token. Expires in ${expireDuration} s.`,
            );

            res.json({ msg: 'Success. You can close this window.' });

            this.startRefreshLoop(expireDuration);
            resolve();
          })
          .catch((err) => {
            const errMsg = `Error getting Tokens: ${err}`;
            res.json({ err: errMsg });
            reject(err);
          });
      });
    });

    const server = app.listen(8888, () => {
      console.log(
        'HTTP Server up. Now go to http://localhost:8888/login in your browser.',
      );
      console.log(
        'Going to try opening the above link in the browser automatically.',
      );
      open('http://localhost:8888/login');
    });

    return p.then(() => {
      // Remember to shut down express, now that we no longer need it for the
      // OAuth flow.
      console.log('Authenticated. HTTP server going down.');
      server.close();
      console.log('Closed HTTP server.');
    });
  }

  private startRefreshLoop(expireDuration: number) {
    setInterval(async () => {
      const refreshData = await this.API.refreshAccessToken();
      const refreshedAccessToken = refreshData.body.access_token;

      console.log('The access token has been refreshed!');
      this.API.setAccessToken(refreshedAccessToken);
    }, (expireDuration / 2) * 1000);
  }

  private async getArtists(artistIDs: string[]): Promise<Map<string, Artist>> {
    // We need to catch the case where there is no artists because the API/SDK
    // errors for some reason if we give it an empty array.
    if (artistIDs.length === 0) return new Map();
    return this.API.getArtists(artistIDs).then((artistsResp) => {
      const artistMap = new Map<string, Artist>();
      artistsResp.body.artists.forEach((artistResp) => {
        artistMap.set(artistResp.id, {
          spotifyID: artistResp.id,
          name: artistResp.name,
          followerCount: artistResp.followers.total,
          genres: artistResp.genres,
          imageURLs: artistResp.images.map((image) => image.url),
          popularity: artistResp.popularity,
        });
      });
      return artistMap;
    });
  }

  private async getTracks(trackIDs: string[]): Promise<Map<string, Track>> {
    // We need to catch the case where there is no artists because the API/SDK
    // errors for some reason if we give it an empty array.
    if (trackIDs.length === 0) return new Map();
    return this.API.getTracks(trackIDs).then((tracksResp) => {
      const trackMap = new Map<string, Track>();
      tracksResp.body.tracks.forEach((trackResp) => {
        trackMap.set(trackResp.id, {
          spotifyID: trackResp.id,
          durationMillis: trackResp.duration_ms,
          isExplicit: trackResp.explicit,
          name: trackResp.name,
          isLocal: trackResp.is_local ?? null,
          previewURL: trackResp.preview_url ?? null,
          popularity: trackResp.popularity,
          album: {
            spotifyID: trackResp.album.id,
            name: trackResp.album.name,
            releaseDate: parse(
              trackResp.album.release_date,
              'yyyy-MM-dd',
              new Date(),
            ),
            type: trackResp.album.album_type,
            trackCount: trackResp.album.total_tracks,
            imageURL: trackResp.album.images[0].url,
          },
        });
      });
      return trackMap;
    });
  }

  async getRecentlyPlayed(after: Date, limit?: number): Promise<Event[]> {
    const afterMS = (getUnixTime(after) + 1) * 1000;
    // TODO: We need to do make this configurable via function argument.
    return this.API.getMyRecentlyPlayedTracks({
      after: afterMS,
      limit,
    })
      .then((data) =>
        data.body.items.map((item) => ({
          playedAt: item.played_at,
          trackID: item.track.id,
          artistIDs: item.track.artists.map((artist) => artist.id),
        })),
      )
      .then(async (recentPlays) => {
        const tracksMap = this.getTracks(
          recentPlays.map((recentPlay) => recentPlay.trackID),
        );
        const artistsMap = this.getArtists(
          recentPlays.flatMap((recentPlay) => recentPlay.artistIDs),
        );
        const spotifyMetadataInfo = await Promise.all([tracksMap, artistsMap]);
        return {
          recentPlays,
          tracksMap: spotifyMetadataInfo[0],
          artistsMap: spotifyMetadataInfo[1],
        };
      })
      .then(({ recentPlays, tracksMap, artistsMap }) =>
        recentPlays.map((recentPlay) => {
          const track = tracksMap.get(recentPlay.trackID)!;
          return {
            playedAt: parseJSON(recentPlay.playedAt),
            track,
            artists: recentPlay.artistIDs.map(
              (artistID) => artistsMap.get(artistID)!,
            ),
          };
        }),
      );
  }
}

export default Spotify;
