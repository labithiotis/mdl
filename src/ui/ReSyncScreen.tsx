import { type BoxProps, Text, type TextProps, useInput } from 'ink';
import type { ReactNode } from 'react';
import { Panel } from './components/Panel';

type ReSyncScreenProps = {
  defaultValue?: boolean;
  description?: ReactNode;
  titleColor?: TextProps['color'];
  borderColor?: BoxProps['borderColor'];
  onSubmit: (value: boolean) => void;
  title: string;
};

export function ReSyncScreen({
  defaultValue = true,
  description,
  onSubmit,
  title,
  titleColor = 'yellow',
  borderColor = 'yellow',
}: ReSyncScreenProps) {
  const hint = defaultValue ? '[Y/n]' : '[y/N]';

  useInput((input, key) => {
    if (key.return) {
      onSubmit(defaultValue);
      return;
    }

    const normalizedInput = input.trim().toLowerCase();

    if (normalizedInput === 'y') onSubmit(true);
    if (normalizedInput === 'n') onSubmit(false);
  });

  return (
    <Panel title={title} titleColor={titleColor} borderColor={borderColor}>
      {!!description && <Text color="gray">{description}</Text>}
      <Text color="blackBright" bold>
        {hint}
      </Text>
    </Panel>
  );
}
