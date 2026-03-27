import type { SyncStage } from '../lib/types';

export type StatusTone = 'cyan' | 'yellow' | 'red' | 'green' | 'magenta';

export type TrackStage = SyncStage | 'queued';

export type WorkerSlotState = {
  downloadPercent?: number;
  fileName?: string;
  fileSizeLabel?: string;
  isActive: boolean;
  message: string;
  stage: TrackStage;
  trackId: string;
  trackIndex: number;
  title: string;
  visible: boolean;
};
