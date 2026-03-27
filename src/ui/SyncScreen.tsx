import { Box, Text } from 'ink';
import type { PlaylistMetadata, SyncProgress } from '../lib/types';
import { ListPanel } from './components/ListPanel';
import { Metric } from './components/Metric';
import { Panel } from './components/Panel';
import { WorkerRow } from './components/WorkerRow';
import type { WorkerSlotState } from './types';

type SyncScreenProps = {
  outputDir: string;
  playlist: PlaylistMetadata;
  progress?: SyncProgress;
  workerSlots: WorkerSlotState[];
};

export function SyncScreen(props: SyncScreenProps) {
  const progress = props.progress;
  const visibleSlots = props.workerSlots.filter((slot) => slot.visible);
  const playlistDirectory = progress?.playlistDir ?? props.outputDir;

  return (
    <Box flexDirection="column">
      <Panel title="Playlist" titleColor="magenta" borderColor="magenta">
        <Box>
          <Text color="greenBright">{props.playlist.title}</Text>
          {!!props.playlist.owner && (
            <Text color="gray"> ⦁ {props.playlist.owner}</Text>
          )}
        </Box>
        <Box marginTop={1} gap={1}>
          <Metric
            label="Done"
            tone="green"
            value={String(progress?.downloaded ?? 0)}
          />
          <Metric
            label="Skipped"
            tone="yellow"
            value={String(progress?.skipped ?? 0)}
          />
          <Metric
            label="Failed"
            tone="red"
            value={String(progress?.failed ?? 0)}
          />
          <Metric
            label="Tracks"
            tone="cyan"
            value={`${progress?.total ?? props.playlist.tracks.length}`}
          />
        </Box>
        <Box marginTop={1}>
          <Text color="gray" italic underline>
            {playlistDirectory}
          </Text>
        </Box>
      </Panel>

      <ListPanel
        title="Tracks"
        borderColor="magenta"
        minRows={20}
        items={visibleSlots}
        renderItem={(slot) => <WorkerRow key={slot.trackId} slot={slot} />}
      />
    </Box>
  );
}
