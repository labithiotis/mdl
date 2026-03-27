import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { WorkerSlotState } from '../types';
import { stageColor, stageSection, statusGlyph } from '../utils/stage';
import { ProgressBar } from './ProgressBar';

type WorkerRowProps = {
  slot: WorkerSlotState;
};

export const TITLE_LENGTH = 30;

export function WorkerRow({ slot }: WorkerRowProps) {
  const color = stageColor(slot.stage);
  const title = slot.title.padEnd(TITLE_LENGTH, ' ');
  const label = stageSection(slot.stage);
  const detail =
    slot.stage === 'failed'
      ? `Error: ${slot.message}`
      : `${label}${slot.stage === 'completed' && slot.fileSizeLabel ? ` • ${slot.fileSizeLabel}` : ''}`;

  return (
    <Box gap={1}>
      {slot.isActive ? (
        <Spinner type="dots" />
      ) : (
        <Text color={color}>{statusGlyph(slot.stage)}</Text>
      )}
      <Text color={color}>{String(slot.trackIndex).padStart(2, '0')}.</Text>
      <Text>{title}</Text>
      <Text color={slot.stage === 'failed' ? 'red' : 'gray'}>{detail}</Text>
      {slot.stage === 'downloading-audio' ? (
        <ProgressBar
          color={color}
          percent={slot.downloadPercent ?? 0}
          showPercent={false}
          width={24}
        />
      ) : null}
    </Box>
  );
}
