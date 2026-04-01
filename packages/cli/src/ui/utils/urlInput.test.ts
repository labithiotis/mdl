import { describe, expect, test } from 'bun:test';
import { normalizeUrlInput } from './urlInput';

describe('urlInput', () => {
  test('keeps a single-line url unchanged', () => {
    expect(
      normalizeUrlInput(
        'https://open.spotify.com/playlist/5GAMKM0kDTvEMk244CL9n2'
      )
    ).toBe('https://open.spotify.com/playlist/5GAMKM0kDTvEMk244CL9n2');
  });

  test('removes multiline whitespace around a pasted url', () => {
    expect(
      normalizeUrlInput(
        '\nhttps://open.spotify.com/playlist/5GAMKM0kDTvEMk244CL9n2\n'
      )
    ).toBe('https://open.spotify.com/playlist/5GAMKM0kDTvEMk244CL9n2');
  });

  test('extracts the first http url from pasted multiline text', () => {
    expect(
      normalizeUrlInput(
        [
          'Here is the playlist link:',
          'https://open.spotify.com/playlist/5GAMKM0kDTvEMk244CL9n2?si=123',
          'let me know if this works',
        ].join('\n')
      )
    ).toBe('https://open.spotify.com/playlist/5GAMKM0kDTvEMk244CL9n2?si=123');
  });

  test('strips spaces when the pasted value contains no url', () => {
    expect(normalizeUrlInput(' spotify playlist ')).toBe('spotifyplaylist');
  });
});
