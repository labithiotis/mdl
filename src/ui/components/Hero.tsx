import { Box, Text } from 'ink';
import { version } from '../../../package.json';

export function Hero() {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      paddingY={0}
    >
      <Box justifyContent="space-between" flexWrap="wrap">
        <Text color="cyanBright" bold>
          mdl - MusicDownLoader
        </Text>
        <Text color="gray">v{version}</Text>
      </Box>
      <Text color="gray">Sync music from major streaming services locally</Text>
    </Box>
  );
}
