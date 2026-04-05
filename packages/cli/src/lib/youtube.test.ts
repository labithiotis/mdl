import { describe, expect, test } from 'bun:test';
import {
  getRequestedContainer,
  isRetryableYouTubeClientError,
  isStreamingDataUnavailableError,
} from './youtube';

describe('youtube audio container selection', () => {
  test('prefers webm for opus output', () => {
    expect(getRequestedContainer('opus')).toBe('webm');
  });

  test('prefers mp4 for non-opus output', () => {
    expect(getRequestedContainer('mp3')).toBe('mp4');
    expect(getRequestedContainer('m4a')).toBe('mp4');
  });
});

describe('youtube client fallback detection', () => {
  test('recognizes unavailable streaming metadata errors', () => {
    expect(
      isStreamingDataUnavailableError(new Error('Streaming data not available'))
    ).toBe(true);
    expect(
      isStreamingDataUnavailableError(new Error('ffmpeg exited with code 1.'))
    ).toBe(false);
  });

  test('recognizes retryable client fallback errors', () => {
    expect(
      isRetryableYouTubeClientError(new Error('Video is login required'))
    ).toBe(true);
    expect(
      isRetryableYouTubeClientError(new Error('Streaming data not available'))
    ).toBe(true);
    expect(
      isRetryableYouTubeClientError(
        new Error('Playback on other websites has been disabled')
      )
    ).toBe(false);
  });
});
