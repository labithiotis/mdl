import { Box, Text } from 'ink';
import type { PlaylistMetadata, SyncProgress, SyncSummary } from '../lib/types';
import { Metric } from './components/Metric';
import { Panel } from './components/Panel';
import { WorkerRow } from './components/WorkerRow';
import type { WorkerSlotState } from './types';

type DoneScreenProps = {
  isResync: boolean;
  playlist: PlaylistMetadata;
  progress?: SyncProgress;
  summary: SyncSummary;
  workerSlots: WorkerSlotState[];
};

export function DoneScreen(props: DoneScreenProps) {
  const finalTrackTotal = props.progress?.total ?? props.playlist.tracks.length;

  return (
    <Box flexDirection="column">
      <Panel title="Finished" borderColor="green" titleColor="green">
        <Box>
          <Text color="greenBright">{props.playlist.title}</Text>
          {!!props.playlist.owner && (
            <Text color="gray"> ⦁ {props.playlist.owner}</Text>
          )}
        </Box>
        <Box marginTop={1} gap={2}>
          <Metric
            label="Downloaded"
            tone="green"
            value={String(props.summary.downloaded)}
          />
          <Metric
            label="Skipped"
            tone="yellow"
            value={String(props.summary.skipped)}
          />
          <Metric
            label="Failed"
            tone="red"
            value={String(props.summary.failed.length)}
          />
          <Metric label="Tracks" tone="cyan" value={String(finalTrackTotal)} />
        </Box>
        <Box marginTop={1}>
          <Text color="gray" italic underline>
            {props.summary.playlistDir}
          </Text>
        </Box>
      </Panel>

      <Panel title="Tracks" borderColor="green" titleColor="green">
        {props.workerSlots.map((slot) => (
          <WorkerRow key={slot.trackId} slot={slot} />
        ))}
      </Panel>
    </Box>
  );
}
