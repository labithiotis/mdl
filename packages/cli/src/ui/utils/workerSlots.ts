import type { PlaylistMetadata, SyncProgress } from '../../lib/types';
import { TITLE_LENGTH } from '../components/WorkerRow';
import type { WorkerSlotState } from '../types';
import { trimTrackTitle } from './trimTrackTitle';

export function createWorkerSlots(
  playlist: PlaylistMetadata,
  _workerCount: number
): WorkerSlotState[] {
  return playlist.tracks.map((track, index) => ({
    downloadPercent: undefined,
    fileName: undefined,
    fileSizeLabel: undefined,
    isActive: false,
    message: 'Queued',
    stage: 'queued',
    trackId: track.id,
    trackIndex: index + 1,
    title: trimTrackTitle(track.title, TITLE_LENGTH),
    visible: true,
  }));
}

export function updateWorkerSlots(
  previousSlots: WorkerSlotState[],
  playlist: PlaylistMetadata,
  progress: SyncProgress
): WorkerSlotState[] {
  const slots =
    previousSlots.length === playlist.tracks.length
      ? [...previousSlots]
      : createWorkerSlots(playlist, progress.workerCount ?? 0);
  const track = progress.track;
  const trackId = track?.id;

  if (!trackId) {
    return slots;
  }

  const slotIndex = slots.findIndex((slot) => slot.trackId === trackId);
  if (slotIndex < 0) {
    return slots;
  }

  const previousSlot = slots[slotIndex];

  slots[slotIndex] = {
    ...previousSlot,
    downloadPercent: progress.downloadPercent,
    fileName: progress.fileName,
    fileSizeLabel: progress.fileSizeLabel,
    isActive:
      progress.stage !== 'completed' &&
      progress.stage !== 'failed' &&
      progress.stage !== 'skipped',
    message: progress.message,
    stage: progress.stage,
    trackId,
    trackIndex: progress.trackIndex ?? slots[slotIndex].trackIndex,
    title: trimTrackTitle(track.title, TITLE_LENGTH),
    visible: true,
  };

  return slots;
}
