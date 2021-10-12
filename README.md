# Description

Updates your music collection CSV file ([example](https://github.com/FOSSforlife/music-collection/blob/main/collection.csv)) from various sources.

# Usage

```bash
 patrician update # Updates from all sources
 patrician update {rym,lastfm,...} # Updates from the specified source
 patrician update playcounts # Updates Last.fm/ListenBrainz play counts for all albums
 patrician add [album name, mbid, or URL] # Coming soon!
 patrician addnp # Adds the currently playing album. Coming soon!
```

# Supported Sources

- [x] Last.fm
- [x] RateYourMusic
- [ ] Spotify
- [ ] ListenBrainz
- [ ] Discogs
- [ ] Beets
- [ ] iTunes/Apple Music
- [ ] MusicBee
- [ ] MediaMonkey
- [ ] foobar2000
- [ ] Text file (format: `{artist} - {album}`)
