import { Box, Text } from 'ink';
import type { StatusTone } from '../types';

type MetricProps = {
  label: string;
  tone: StatusTone;
  value: string;
};

export function Metric(props: MetricProps) {
  return (
    <Box flexDirection="column">
      <Text color={props.tone}>{props.value}</Text>
      <Text color={props.tone}>{props.label}</Text>
    </Box>
  );
}
