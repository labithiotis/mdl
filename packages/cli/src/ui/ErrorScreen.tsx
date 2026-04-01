import { Box, Text } from 'ink';
import { Panel } from './components/Panel';

type ErrorScreenProps = {
  message: string;
};

export function ErrorScreen(props: ErrorScreenProps) {
  return (
    <Box flexDirection="column" gap={1}>
      <Panel title="Error">
        <Text color="redBright">{props.message}</Text>
        <Text color="gray">The process will exit shortly.</Text>
      </Panel>
    </Box>
  );
}
