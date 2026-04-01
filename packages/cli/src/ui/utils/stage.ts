import type { StatusTone, TrackStage } from '../types';

export function stageColor(stage: TrackStage): StatusTone {
  switch (stage) {
    case 'completed':
      return 'green';
    case 'skipped':
      return 'yellow';
    case 'failed':
      return 'red';
    case 'queued':
      return 'magenta';
    case 'writing-metadata':
    case 'writing-manifest':
      return 'magenta';
    default:
      return 'cyan';
  }
}

export function statusGlyph(stage: TrackStage): string {
  switch (stage) {
    case 'completed':
      return '+';
    case 'skipped':
      return '!';
    case 'failed':
      return 'x';
    case 'queued':
      return '·';
    default:
      return '·';
  }
}

export function stageSection(stage: TrackStage): string {
  switch (stage) {
    case 'queued':
      return 'Queued';
    case 'initializing':
    case 'searching-youtube':
      return 'Searching';
    case 'downloading-audio':
    case 'writing-metadata':
    case 'writing-manifest':
      return 'Download';
    case 'completed':
      return 'Complete';
    case 'skipped':
      return 'Skipped (already downloaded)';
    case 'failed':
      return 'Error';
    default:
      return 'Queued';
  }
}
