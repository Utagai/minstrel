import { Pool } from 'pg';

import Event from './Event';

type LoadResult = {
  stmt: string;
  event: Event;
  success: boolean;
  error?: Error;
};

type Values = {
  spotifyID: string;
  otherColumns: any[];
};

/**
 * AKA, a lesson in why you should probably use an ORM.
 */
class Inserter {
  pool: Pool;

  spotifyIDToSerial: Map<string, number>;

  initializationTime: Date;

  constructor() {
    this.pool = new Pool();
    this.spotifyIDToSerial = new Map();
    // TODO: There may be a timezone bug here.
    this.initializationTime = new Date();
  }

  async getLatestEventTimestamp(): Promise<Date> {
    return this.pool
      .query('SELECT ts FROM events ORDER BY ts DESC LIMIT 1')
      .then((res) => {
        if (res.rowCount < 1) {
          // Database is empty.
          // Therefore, give back the initialization time until it gets
          // something back, after which this conditional will never execute.
          return this.initializationTime;
        }
        return res.rows[0]?.ts;
      });
  }

  /**
   * Loads the given events into the database as rows to the entity tables
   * (albums, artists and tracks).
   *
   * @param {Event[]} events - The Spotify listen events to extract data from
   * and insert.
   * @param {string} stmt - The SQL statement to execute in order to
   * insert the column values returned by the extractor. This insert statement
   * must have its first column value be the Spotify ID.
   * @param {(e: Event) => Values[]} extractor - A closure to execute for each
   * event that returns a listing of column value sets per event (maps to a
   * row).
   */
  insertEventEntities(
    events: Event[],
    stmt: string,
    extractor: (e: Event) => Values[],
  ): Promise<LoadResult[]> {
    const queries = events.flatMap((event) => {
      const extracts = extractor(event);
      return extracts.map((extract) =>
        this.pool
          .query(stmt, [extract.spotifyID, ...extract.otherColumns])
          .then((queryRes) => {
            this.spotifyIDToSerial.set(extract.spotifyID, queryRes.rows[0]?.id);
            return {
              stmt,
              event,
              success: true,
            };
          })
          .catch((queryErr) => ({
            stmt,
            event,
            success: false,
            error: queryErr,
          })),
      );
    });
    return Promise.all(queries);
  }

  async insertAlbums(events: Event[]): Promise<LoadResult[]> {
    const stmt = `INSERT INTO
    albums(spotify_id, album_name, release_date, album_type, track_count, image_url)
    VALUES($1,         $2,         $3,           $4,         $5,          $6       )
    ON CONFLICT ON CONSTRAINT albums_spotify_id_key
    DO
      UPDATE SET
        image_url = EXCLUDED.image_url
    RETURNING id`;
    return this.insertEventEntities(events, stmt, (e: Event) => [
      {
        spotifyID: e.track.album.spotifyID,
        otherColumns: [
          e.track.album.name,
          e.track.album.releaseDate,
          e.track.album.type,
          e.track.album.trackCount,
          e.track.album.imageURL,
        ],
      },
    ]);
  }

  async insertTracks(events: Event[]): Promise<LoadResult[]> {
    const stmt = `INSERT INTO
    tracks(spotify_id, duration_ms, is_explicit, track_name, is_local, preview_url, popularity)
    VALUES($1,         $2,          $3,          $4,         $5,       $6,          $7        )
    ON CONFLICT ON CONSTRAINT tracks_spotify_id_key
    DO
      UPDATE SET
        popularity = EXCLUDED.popularity
    RETURNING id`;
    return this.insertEventEntities(events, stmt, (e: Event) => [
      {
        spotifyID: e.track.spotifyID,
        otherColumns: [
          e.track.durationMillis,
          e.track.isExplicit,
          e.track.name,
          e.track.isLocal,
          e.track.previewURL,
          e.track.popularity,
        ],
      },
    ]);
  }

  async insertArtists(events: Event[]): Promise<LoadResult[]> {
    const stmt = `INSERT INTO
    artists(spotify_id, artist_name, follower_count, genres, image_urls, popularity)
    VALUES ($1,         $2,          $3,             $4,     $5,         $6        )
    ON CONFLICT ON CONSTRAINT artists_spotify_id_key
    DO
      UPDATE SET
        follower_count = EXCLUDED.follower_count,
        genres = EXCLUDED.genres,
        image_urls = EXCLUDED.image_urls,
        popularity = EXCLUDED.popularity
    RETURNING id`;
    return this.insertEventEntities(events, stmt, (e: Event) =>
      e.artists.map((artist) => ({
        spotifyID: artist.spotifyID,
        otherColumns: [
          artist.name,
          artist.followerCount,
          artist.genres,
          artist.imageURLs,
          artist.popularity,
        ],
      })),
    );
  }

  insertJoinTableEntries(
    stmt: string,
    joinPairs: [number, number][],
  ): Promise<LoadResult[]> {
    return Promise.all(
      joinPairs.map((joinPair) =>
        this.pool
          .query(stmt, joinPair)
          .then((_) => ({ stmt, success: true }))
          .catch((queryErr) => ({
            stmt,
            success: false,
            error: queryErr,
          })),
      ),
    );
  }

  async insertAlbumArtist(events: Event[]): Promise<LoadResult[]> {
    const stmt = `INSERT INTO
    album_artist(album_id, artist_id)
    VALUES      ($1,       $2       )
    ON CONFLICT ON CONSTRAINT album_artist_pkey
    DO NOTHING`;
    const joinPairs = events.flatMap((event) => {
      const albumSerialID = this.spotifyIDToSerial.get(
        event.track.album.spotifyID,
      )!;
      return event.artists.map((artist): [number, number] => [
        albumSerialID,
        this.spotifyIDToSerial.get(artist.spotifyID)!,
      ]);
    });

    return this.insertJoinTableEntries(stmt, joinPairs);
  }

  async insertAlbumTrack(events: Event[]): Promise<LoadResult[]> {
    const stmt = `INSERT INTO
    album_track(album_id, track_id)
    VALUES     ($1,       $2      )
    ON CONFLICT ON CONSTRAINT album_track_pkey
    DO NOTHING`;
    const joinPairs = events.map((event): [number, number] => {
      const albumSerialID = this.spotifyIDToSerial.get(
        event.track.album.spotifyID,
      )!;
      const trackSerialID = this.spotifyIDToSerial.get(event.track.spotifyID)!;
      return [albumSerialID, trackSerialID];
    });

    return this.insertJoinTableEntries(stmt, joinPairs);
  }

  async insertTrackArtist(events: Event[]): Promise<LoadResult[]> {
    const stmt = `INSERT INTO
    track_artist(track_id, artist_id)
    VALUES      ($1,       $2       )
    ON CONFLICT ON CONSTRAINT track_artist_pkey
    DO NOTHING`;
    const joinPairs = events.flatMap((event) => {
      const trackSerialID = this.spotifyIDToSerial.get(event.track.spotifyID)!;

      return event.artists.map((artist): [number, number] => [
        trackSerialID,
        this.spotifyIDToSerial.get(artist.spotifyID)!,
      ]);
    });

    return this.insertJoinTableEntries(stmt, joinPairs);
  }

  async insertEventsTable(events: Event[]): Promise<LoadResult[]> {
    const stmt = `INSERT INTO
      events(ts, track_id, album_id)
      VALUES($1, $2,       $3      )
      ON CONFLICT ON CONSTRAINT events_pkey
      DO NOTHING`;
    return Promise.all(
      events.map(async (event) => {
        const ts = event.playedAt;
        const trackSerialID = this.spotifyIDToSerial.get(
          event.track.spotifyID,
        )!;
        const albumSerialID = this.spotifyIDToSerial.get(
          event.track.album.spotifyID,
        )!;
        return this.pool
          .query(stmt, [ts, trackSerialID, albumSerialID])
          .then((_) => ({ stmt, success: true }))
          .catch((queryErr) => ({ stmt, success: false, error: queryErr }));
      }),
    );
  }

  async insert(events: Event[]): Promise<LoadResult[]> {
    // First, insert the data into the entity tables (tracks, artists, albums).
    // Then, insert to the JOIN tables.
    // Finally, insert to the events table.

    const entityLoadResults = await mergeResults(
      this.insertTracks(events),
      this.insertArtists(events),
      this.insertAlbums(events),
    );

    const joinTableLoadResults = await mergeResults(
      this.insertAlbumArtist(events),
      this.insertAlbumTrack(events),
      this.insertTrackArtist(events),
      this.insertEventsTable(events),
    );

    return entityLoadResults.concat(joinTableLoadResults);
  }
}

async function mergeResults(
  ...results: Promise<LoadResult[]>[]
): Promise<LoadResult[]> {
  return Promise.all(results).then((resultArrs) =>
    resultArrs.flatMap((resultArr) => resultArr),
  );
}

export default Inserter;
