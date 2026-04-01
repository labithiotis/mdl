import { describe, expect, test } from 'bun:test';
import { BandcampProvider } from './Bandcamp';

const provider = new BandcampProvider();

describe('bandcamp', () => {
  test('parses Bandcamp playlist metadata from the page data blob', () => {
    const html = `
  <!DOCTYPE html>
  <html>
    <body>
      <div id="pagedata" data-blob="{&quot;appData&quot;:{&quot;playlistId&quot;:551253,&quot;title&quot;:&quot;Fuzzy&#39;s Fresh Fuzz&quot;,&quot;imageId&quot;:39779773,&quot;curator&quot;:{&quot;name&quot;:&quot;Fuzzy Cracklins&quot;},&quot;tracks&quot;:[{&quot;id&quot;:4294444853,&quot;title&quot;:&quot;Trinity&quot;,&quot;url&quot;:&quot;https://mudfinger.bandcamp.com/track/trinity&quot;,&quot;artistName&quot;:&quot;MUDFINGER&quot;,&quot;duration&quot;:355.383,&quot;artId&quot;:1917792689,&quot;album&quot;:{&quot;title&quot;:&quot;Amentia - Album&quot;}}]}}"></div>
    </body>
  </html>
  `;

    const playlist = provider.parsePlaylistHtml(
      html,
      'https://bandcamp.com/fuzzycracklins/playlist/fuzzys-fresh-fuzz'
    );

    expect(playlist.provider).toBe('bandcamp');
    expect(playlist.id).toBe('551253');
    expect(playlist.title).toBe("Fuzzy's Fresh Fuzz");
    expect(playlist.owner).toBe('Fuzzy Cracklins');
    expect(playlist.artworkUrl).toBe(
      'https://f4.bcbits.com/img/0039779773_71.jpg'
    );
    expect(playlist.tracks[0]).toEqual({
      id: '4294444853',
      title: 'Trinity',
      artists: ['MUDFINGER'],
      album: 'Amentia - Album',
      artworkUrl: 'https://f4.bcbits.com/img/1917792689_71.jpg',
      durationMs: 355383,
      sourceUrl: 'https://mudfinger.bandcamp.com/track/trinity',
    });
  });

  test('parses Bandcamp Daily list articles into featured tracks', () => {
    const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta property="og:title" content="The Long, Joyous Tradition of Cajun and Creole Accordion Music">
      <meta property="og:image" content="https://f4.bcbits.com/img/0043322492_171.jpg">
    </head>
    <body>
      <div
        id="p-daily-article"
        data-player-infos="[{&quot;player_id&quot;:&quot;t4180305335&quot;,&quot;featured_track_number&quot;:8,&quot;art_id&quot;:435169997,&quot;band_name&quot;:&quot;Marcella Simien&quot;,&quot;tralbum_url&quot;:&quot;https://marcellaandherlovers.bandcamp.com/album/live-from-memphis&quot;,&quot;title&quot;:&quot;Live From Memphis&quot;,&quot;tracklist&quot;:[{&quot;track_id&quot;:4180305335,&quot;track_title&quot;:&quot;Where You Are&quot;,&quot;artist&quot;:&quot;Marcella and Her Lovers&quot;,&quot;art_id&quot;:435169997,&quot;audio_track_duration&quot;:201.806,&quot;track_number&quot;:8}]}]"></div>
    </body>
  </html>
  `;

    const playlist = provider.parsePlaylistHtml(
      html,
      'https://daily.bandcamp.com/lists/cajun-creole-accordion-music-guide'
    );

    expect(playlist.provider).toBe('bandcamp');
    expect(playlist.id).toBe(
      'https://daily.bandcamp.com/lists/cajun-creole-accordion-music-guide'
    );
    expect(playlist.title).toBe(
      'The Long, Joyous Tradition of Cajun and Creole Accordion Music'
    );
    expect(playlist.owner).toBe('Bandcamp Daily');
    expect(playlist.artworkUrl).toBe(
      'https://f4.bcbits.com/img/0043322492_171.jpg'
    );
    expect(playlist.tracks[0]).toEqual({
      id: '4180305335',
      title: 'Where You Are',
      artists: ['Marcella and Her Lovers'],
      album: 'Live From Memphis',
      artworkUrl: 'https://f4.bcbits.com/img/0435169997_71.jpg',
      durationMs: 201806,
      sourceUrl:
        'https://marcellaandherlovers.bandcamp.com/album/live-from-memphis',
    });
  });

  test('parses Bandcamp album pages into tracks', () => {
    const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <script type="application/ld+json">
        {"@type":"MusicAlbum","@id":"https://marcellaandherlovers.bandcamp.com/album/live-from-memphis","name":"Live From Memphis","albumRelease":[{"additionalProperty":[{"name":"item_id","value":1093807616}],"image":["https://f4.bcbits.com/img/a0435169997_10.jpg"]}],"byArtist":{"name":"Marcell and Her Lovers"},"publisher":{"name":"Marcella Simien"},"track":{"itemListElement":[{"item":{"@id":"https://marcellaandherlovers.bandcamp.com/track/where-you-are-2","additionalProperty":[{"name":"track_id","value":4180305335}],"name":"Where You Are","duration":"PT3M21.806S","mainEntityOfPage":"https://marcellaandherlovers.bandcamp.com/track/where-you-are-2"}}]}}
      </script>
    </head>
  </html>
  `;

    const playlist = provider.parsePlaylistHtml(
      html,
      'https://marcellaandherlovers.bandcamp.com/album/live-from-memphis'
    );

    expect(playlist.id).toBe('1093807616');
    expect(playlist.title).toBe('Live From Memphis');
    expect(playlist.owner).toBe('Marcell and Her Lovers');
    expect(playlist.artworkUrl).toBe(
      'https://f4.bcbits.com/img/a0435169997_10.jpg'
    );
    expect(playlist.tracks[0]).toEqual({
      id: '4180305335',
      title: 'Where You Are',
      artists: [],
      artworkUrl: 'https://f4.bcbits.com/img/a0435169997_10.jpg',
      durationMs: 201806,
      sourceUrl:
        'https://marcellaandherlovers.bandcamp.com/track/where-you-are-2',
    });
  });
});
