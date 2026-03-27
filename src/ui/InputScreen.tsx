import { Text } from 'ink';
import { MANIFEST_FILE_NAME } from '../lib/manifest';
import {
  formatProviderName,
  RECOGNIZED_PROVIDERS,
} from '../lib/providers/Providers';
import { Panel } from './components/Panel';
import { UrlInput } from './components/UrlInput';

type InputScreenProps = {
  errorMessage?: string;
  outputDir: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  url: string;
};

export function InputScreen(props: InputScreenProps) {
  return (
    <Panel title="Music URL" titleColor="green" borderColor="green">
      <Text color="green">
        {RECOGNIZED_PROVIDERS.map(formatProviderName).join(', ')}
      </Text>
      <Text>Paste a music URL and press Enter:</Text>
      <UrlInput
        value={props.url}
        onChange={props.onChange}
        onSubmit={props.onSubmit}
      />
      {props.errorMessage ? (
        <Text color="redBright">{props.errorMessage}</Text>
      ) : (
        <Text> </Text>
      )}
      <Text color="grey" italic>
        A folder in {props.outputDir}/&#123;
        <Text bold italic>
          playlist
        </Text>
        &#125; will be created with music files and a{' '}
        <Text bold italic>
          {MANIFEST_FILE_NAME}
        </Text>{' '}
        manifest
      </Text>
    </Panel>
  );
}
