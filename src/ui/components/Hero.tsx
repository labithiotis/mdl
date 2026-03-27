import { Box, Text } from 'ink';

export function Hero() {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      paddingY={0}
    >
      <Text color="cyanBright" bold>
        mdl - MusicDownLoader
      </Text>
      <Text color="gray">Sync music from major streaming services locally</Text>
    </Box>
  );
}
