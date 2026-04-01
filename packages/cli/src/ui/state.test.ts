import { describe, expect, test } from 'bun:test';
import { reducer } from './state';

describe('state', () => {
  test('submit-url keeps the user on input when the URL is empty', () => {
    const state = {
      url: '',
      phase: { kind: 'collecting-input' as const },
    };

    const nextState = reducer(state, { type: 'submit-url', value: '   ' });

    expect(nextState).toEqual({
      url: '',
      phase: {
        kind: 'collecting-input',
        errorMessage: 'Enter a music URL.',
      },
    });
  });

  test('submit-url rejects malformed URLs before playlist lookup starts', () => {
    const state = {
      url: 'spotify playlist',
      phase: { kind: 'collecting-input' as const },
    };

    const nextState = reducer(state, {
      type: 'submit-url',
      value: 'spotify playlist',
    });

    expect(nextState).toEqual({
      url: '',
      phase: {
        kind: 'collecting-input',
        errorMessage:
          'Invalid URL. Provide a full http:// or https:// music URL.',
      },
    });
  });

  test('submit-url rejects unsupported providers before playlist lookup starts', () => {
    const state = {
      url: 'https://google.com/example',
      phase: { kind: 'collecting-input' as const },
    };

    const nextState = reducer(state, {
      type: 'submit-url',
      value: 'https://google.com/example',
    });

    expect(nextState.url).toBe('');
    expect(nextState.phase.kind).toBe('collecting-input');
    if (nextState.phase.kind !== 'collecting-input') {
      throw new Error('Expected collecting-input phase');
    }

    expect(nextState.phase.errorMessage ?? '').toMatch(/Unsupported music URL/);
  });

  test('submit-url starts playlist lookup for recognized providers', () => {
    const state = {
      url: 'https://open.spotify.com/playlist/5GAMKM0kDTvEMk244CL9n2',
      phase: { kind: 'collecting-input' as const },
    };

    const nextState = reducer(state, {
      type: 'submit-url',
      value: 'https://open.spotify.com/playlist/5GAMKM0kDTvEMk244CL9n2',
    });

    expect(nextState).toEqual({
      url: 'https://open.spotify.com/playlist/5GAMKM0kDTvEMk244CL9n2',
      phase: {
        canRetryInput: true,
        isResync: false,
        kind: 'loading-playlist',
        url: 'https://open.spotify.com/playlist/5GAMKM0kDTvEMk244CL9n2',
        message: 'Starting playlist lookup',
      },
    });
  });
});
