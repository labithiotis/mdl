import { Text } from 'ink';
import type { StatusTone } from '../types';

type ProgressBarProps = {
  color?: StatusTone;
  percent: number;
  showPercent?: boolean;
  width: number;
};

export function ProgressBar(props: ProgressBarProps) {
  const clampedPercent = Math.max(0, Math.min(100, props.percent));
  const displayPercent = Math.round(clampedPercent);
  const filled = Math.round((clampedPercent / 100) * props.width);
  const bar = `[${'='.repeat(filled)}${'-'.repeat(props.width - filled)}]`;

  return (
    <Text color={props.color}>
      {bar}
      {!!props.showPercent && ` ${String(displayPercent)}%`.padEnd(5, ' ')}
    </Text>
  );
}
