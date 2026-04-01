import { Box, type BoxProps, Spacer, Text, type TextProps } from 'ink';
import Spinner from 'ink-spinner';
import { detectProvider, formatProviderName } from '../lib/providers/Providers';
import { Panel } from './components/Panel';

type LoadingScreenProps = {
  title: string;
  titleColor?: TextProps['color'];
  borderColor?: BoxProps['borderColor'];
  message: string;
  url: string;
};

export function LoadingScreen(props: LoadingScreenProps) {
  const provider = detectProvider(props.url);
  const providerName =
    provider === 'unknown' ? 'Checking provider' : formatProviderName(provider);

  return (
    <Box flexDirection="column" gap={1}>
      <Panel
        title={props.title}
        titleColor={props.titleColor}
        borderColor={props.borderColor}
      >
        <Spinner type="simpleDots" />
        <Spacer />
        <Text color="cyan">{props.message}</Text>
        <Text color="gray">{`${providerName} • ${props.url}`}</Text>
      </Panel>
    </Box>
  );
}
