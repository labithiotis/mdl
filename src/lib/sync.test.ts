import { afterEach, describe, expect, mock, test } from 'bun:test';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { PlaylistMetadata } from './types';

mock.module('./metadata', () => ({
  writeTrackMetadata: mock(async () => undefined),
}));

mock.module('./youtube', () => ({
  downloadTrackAudio: mock(),
  searchYoutubeTrackCandidates: mock(),
}));

import { syncPlaylist } from './sync';
import { downloadTrackAudio, searchYoutubeTrackCandidates } from './youtube';

const mockedSearchYoutubeTrackCandidates =
  searchYoutubeTrackCandidates as ReturnType<typeof mock>;
const mockedDownloadTrackAudio = downloadTrackAudio as ReturnType<typeof mock>;

const playlist: PlaylistMetadata = {
  id: 'playlist-1',
  title: 'Test Playlist',
  owner: 'Tester',
  artworkUrl: undefined,
  provider: 'spotify',
  sourceUrl: 'https://open.spotify.com/playlist/playlist-1',
  tracks: [
    {
      id: 'track-1',
      title: 'Track One',
      artists: ['Artist One'],
      album: 'Album One',
      artworkUrl: undefined,
      durationMs: 123000,
      sourceUrl: 'https://open.spotify.com/track/track-1',
    },
  ],
};

afterEach(() => {
  mock.restore();
});

describe('syncPlaylist', () => {
  test('retries a track when a fetch failure bubbles out of track processing', async () => {
    const outputRootDir = await mkdtemp(path.join(os.tmpdir(), 'mdl-sync-'));

    mockedSearchYoutubeTrackCandidates
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValue([
        {
          id: 'yt-1',
          url: 'https://youtube.com/watch?v=yt-1',
          title: 'track1',
        },
      ]);

    mockedDownloadTrackAudio.mockImplementation(
      async (params: { destinationDir: string }) => {
        await mkdir(params.destinationDir, { recursive: true });
        const relativePath = '01-track-one.mp3';
        await writeFile(
          path.join(params.destinationDir, relativePath),
          'audio'
        );

        return {
          fileName: '01-track-one.mp3',
          relativePath,
        };
      }
    );

    const summary = await syncPlaylist({
      downloadParallelism: 1,
      outputRootDir,
      playlist,
    });

    expect(mockedSearchYoutubeTrackCandidates).toHaveBeenCalledTimes(2);
    expect(mockedDownloadTrackAudio).toHaveBeenCalledTimes(1);
    expect(summary.downloaded).toBe(1);
    expect(summary.failed).toEqual([]);
  }, 10000);
});
