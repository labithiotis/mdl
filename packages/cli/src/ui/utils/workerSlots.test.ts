import { describe, expect, test } from 'bun:test';
import type { PlaylistMetadata, SyncProgress } from '../../lib/types';
import { createWorkerSlots, updateWorkerSlots } from './workerSlots';

describe('updateWorkerSlots', () => {
  test('updates the indexed duplicate track instead of the first matching track ID', () => {
    const playlist: PlaylistMetadata = {
      id: 'playlist-1',
      provider: 'spotify',
      sourceUrl: 'https://open.spotify.com/playlist/playlist-1',
      title: 'Duplicate tracks',
      tracks: [
        { artists: ['Artist'], id: 'duplicate-track', title: 'First copy' },
        { artists: ['Artist'], id: 'duplicate-track', title: 'Second copy' },
      ],
    };
    const progress: SyncProgress = {
      completed: 1,
      current: 2,
      downloaded: 1,
      failed: 0,
      message: 'Finished',
      playlistDir: '/music/Duplicate tracks',
      skipped: 0,
      stage: 'completed',
      total: 2,
      track: playlist.tracks[1],
      trackIndex: 2,
    };

    const slots = updateWorkerSlots(createWorkerSlots(playlist, 1), playlist, progress);

    expect(slots.map((slot) => slot.stage)).toEqual(['queued', 'completed']);
    expect(slots.map((slot) => slot.message)).toEqual(['Queued', 'Finished']);
  });

  test('ignores progress with an unknown track index', () => {
    const playlist: PlaylistMetadata = {
      id: 'playlist-1',
      provider: 'spotify',
      sourceUrl: 'https://open.spotify.com/playlist/playlist-1',
      title: 'One track',
      tracks: [{ artists: ['Artist'], id: 'track-1', title: 'Track' }],
    };
    const progress: SyncProgress = {
      completed: 0,
      current: 2,
      downloaded: 0,
      failed: 0,
      message: 'Preparing track',
      playlistDir: '/music/One track',
      skipped: 0,
      stage: 'initializing',
      total: 1,
      track: playlist.tracks[0],
      trackIndex: 2,
    };

    expect(updateWorkerSlots(createWorkerSlots(playlist, 1), playlist, progress)).toEqual(
      createWorkerSlots(playlist, 1)
    );
  });
});
