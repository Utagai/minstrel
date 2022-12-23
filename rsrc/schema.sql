--
-- PostgreSQL database dump
--

-- Dumped from database version 13.6
-- Dumped by pg_dump version 13.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: album_artist; Type: TABLE; Schema: public; Owner: minstrel
--

CREATE TABLE public.album_artist (
    album_id bigint NOT NULL,
    artist_id bigint NOT NULL
);


ALTER TABLE public.album_artist OWNER TO minstrel;

--
-- Name: album_track; Type: TABLE; Schema: public; Owner: minstrel
--

CREATE TABLE public.album_track (
    album_id bigint NOT NULL,
    track_id bigint NOT NULL
);


ALTER TABLE public.album_track OWNER TO minstrel;

--
-- Name: albums; Type: TABLE; Schema: public; Owner: minstrel
--

CREATE TABLE public.albums (
    id bigint NOT NULL,
    spotify_id character varying(30) NOT NULL,
    album_name text NOT NULL,
    release_date date NOT NULL,
    album_type character varying(30) NOT NULL,
    track_count smallint NOT NULL,
    image_url text NOT NULL
);


ALTER TABLE public.albums OWNER TO minstrel;

--
-- Name: albums_album_id_seq; Type: SEQUENCE; Schema: public; Owner: minstrel
--

CREATE SEQUENCE public.albums_album_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.albums_album_id_seq OWNER TO minstrel;

--
-- Name: albums_album_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: minstrel
--

ALTER SEQUENCE public.albums_album_id_seq OWNED BY public.albums.id;


--
-- Name: artists; Type: TABLE; Schema: public; Owner: minstrel
--

CREATE TABLE public.artists (
    id bigint NOT NULL,
    spotify_id character varying(30) NOT NULL,
    artist_name text NOT NULL,
    follower_count integer NOT NULL,
    genres character varying(100)[] NOT NULL,
    image_urls text[] NOT NULL,
    popularity smallint NOT NULL
);


ALTER TABLE public.artists OWNER TO minstrel;

--
-- Name: artists_artist_id_seq; Type: SEQUENCE; Schema: public; Owner: minstrel
--

CREATE SEQUENCE public.artists_artist_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.artists_artist_id_seq OWNER TO minstrel;

--
-- Name: artists_artist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: minstrel
--

ALTER SEQUENCE public.artists_artist_id_seq OWNED BY public.artists.id;


--
-- Name: events; Type: TABLE; Schema: public; Owner: minstrel
--

CREATE TABLE public.events (
    ts timestamp without time zone NOT NULL,
    track_id bigint NOT NULL,
    album_id bigint NOT NULL
);


ALTER TABLE public.events OWNER TO minstrel;

--
-- Name: track_artist; Type: TABLE; Schema: public; Owner: minstrel
--

CREATE TABLE public.track_artist (
    track_id bigint NOT NULL,
    artist_id bigint NOT NULL
);


ALTER TABLE public.track_artist OWNER TO minstrel;

--
-- Name: tracks; Type: TABLE; Schema: public; Owner: minstrel
--

CREATE TABLE public.tracks (
    id bigint NOT NULL,
    spotify_id character varying(30) NOT NULL,
    duration_ms integer NOT NULL,
    is_explicit boolean NOT NULL,
    track_name text NOT NULL,
    is_local boolean NOT NULL,
    preview_url text,
    popularity smallint NOT NULL
);


ALTER TABLE public.tracks OWNER TO minstrel;

--
-- Name: tracks_track_id_seq; Type: SEQUENCE; Schema: public; Owner: minstrel
--

CREATE SEQUENCE public.tracks_track_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tracks_track_id_seq OWNER TO minstrel;

--
-- Name: tracks_track_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: minstrel
--

ALTER SEQUENCE public.tracks_track_id_seq OWNED BY public.tracks.id;


--
-- Name: albums id; Type: DEFAULT; Schema: public; Owner: minstrel
--

ALTER TABLE ONLY public.albums ALTER COLUMN id SET DEFAULT nextval('public.albums_album_id_seq'::regclass);


--
-- Name: artists id; Type: DEFAULT; Schema: public; Owner: minstrel
--

ALTER TABLE ONLY public.artists ALTER COLUMN id SET DEFAULT nextval('public.artists_artist_id_seq'::regclass);


--
-- Name: tracks id; Type: DEFAULT; Schema: public; Owner: minstrel
--

ALTER TABLE ONLY public.tracks ALTER COLUMN id SET DEFAULT nextval('public.tracks_track_id_seq'::regclass);


--
-- Name: album_artist album_artist_pkey; Type: CONSTRAINT; Schema: public; Owner: minstrel
--

ALTER TABLE ONLY public.album_artist
    ADD CONSTRAINT album_artist_pkey PRIMARY KEY (album_id, artist_id);


--
-- Name: album_track album_track_pkey; Type: CONSTRAINT; Schema: public; Owner: minstrel
--

ALTER TABLE ONLY public.album_track
    ADD CONSTRAINT album_track_pkey PRIMARY KEY (album_id, track_id);


--
-- Name: albums albums_pkey; Type: CONSTRAINT; Schema: public; Owner: minstrel
--

ALTER TABLE ONLY public.albums
    ADD CONSTRAINT albums_pkey PRIMARY KEY (id);


--
-- Name: albums albums_spotify_id_key; Type: CONSTRAINT; Schema: public; Owner: minstrel
--

ALTER TABLE ONLY public.albums
    ADD CONSTRAINT albums_spotify_id_key UNIQUE (spotify_id);


--
-- Name: artists artists_pkey; Type: CONSTRAINT; Schema: public; Owner: minstrel
--

ALTER TABLE ONLY public.artists
    ADD CONSTRAINT artists_pkey PRIMARY KEY (id);


--
-- Name: artists artists_spotify_id_key; Type: CONSTRAINT; Schema: public; Owner: minstrel
--

ALTER TABLE ONLY public.artists
    ADD CONSTRAINT artists_spotify_id_key UNIQUE (spotify_id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: minstrel
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (ts);


--
-- Name: track_artist track_artist_pkey; Type: CONSTRAINT; Schema: public; Owner: minstrel
--

ALTER TABLE ONLY public.track_artist
    ADD CONSTRAINT track_artist_pkey PRIMARY KEY (track_id, artist_id);


--
-- Name: tracks tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: minstrel
--

ALTER TABLE ONLY public.tracks
    ADD CONSTRAINT tracks_pkey PRIMARY KEY (id);


--
-- Name: tracks tracks_spotify_id_key; Type: CONSTRAINT; Schema: public; Owner: minstrel
--

ALTER TABLE ONLY public.tracks
    ADD CONSTRAINT tracks_spotify_id_key UNIQUE (spotify_id);


--
-- Name: album_artist albumfk; Type: FK CONSTRAINT; Schema: public; Owner: minstrel
--

ALTER TABLE ONLY public.album_artist
    ADD CONSTRAINT albumfk FOREIGN KEY (album_id) REFERENCES public.albums(id) MATCH FULL;


--
-- Name: album_track albumfk; Type: FK CONSTRAINT; Schema: public; Owner: minstrel
--

ALTER TABLE ONLY public.album_track
    ADD CONSTRAINT albumfk FOREIGN KEY (album_id) REFERENCES public.albums(id) MATCH FULL;


--
-- Name: album_artist artistfk; Type: FK CONSTRAINT; Schema: public; Owner: minstrel
--

ALTER TABLE ONLY public.album_artist
    ADD CONSTRAINT artistfk FOREIGN KEY (artist_id) REFERENCES public.artists(id) MATCH FULL;


--
-- Name: track_artist artistfk; Type: FK CONSTRAINT; Schema: public; Owner: minstrel
--

ALTER TABLE ONLY public.track_artist
    ADD CONSTRAINT artistfk FOREIGN KEY (artist_id) REFERENCES public.artists(id) MATCH FULL;


--
-- Name: events events_album_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: minstrel
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_album_id_fkey FOREIGN KEY (album_id) REFERENCES public.albums(id);


--
-- Name: events events_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: minstrel
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.tracks(id);


--
-- Name: album_track trackfk; Type: FK CONSTRAINT; Schema: public; Owner: minstrel
--

ALTER TABLE ONLY public.album_track
    ADD CONSTRAINT trackfk FOREIGN KEY (track_id) REFERENCES public.tracks(id) MATCH FULL;


--
-- Name: track_artist trackfk; Type: FK CONSTRAINT; Schema: public; Owner: minstrel
--

ALTER TABLE ONLY public.track_artist
    ADD CONSTRAINT trackfk FOREIGN KEY (track_id) REFERENCES public.tracks(id) MATCH FULL;


--
-- PostgreSQL database dump complete
--

