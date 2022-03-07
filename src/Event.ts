import Track from './Track';
import Artist from './Artist';

type Event = {
  playedAt: Date;
  track: Track;
  artists: Artist[];
};

export default Event;
