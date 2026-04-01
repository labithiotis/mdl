import { Box, useApp } from 'ink';
import { useEffect, useReducer, useRef } from 'react';
import type { AudioFormat, AudioQuality } from '../lib/args';
import {
  formatProviderName,
  providers,
  validateProviderUrl,
} from '../lib/providers/Providers';
import { syncPlaylist } from '../lib/sync';
import type { SyncManifest } from '../lib/types';
import { Hero } from './components/Hero';
import { DoneScreen } from './DoneScreen';
import { ErrorScreen } from './ErrorScreen';
import { InputScreen } from './InputScreen';
import { LoadingScreen } from './LoadingScreen';
import { ReSyncScreen } from './ReSyncScreen';
import { SyncScreen } from './SyncScreen';
import type { Phase } from './state';
import { createInitialState, reducer } from './state';

type AppProps = {
  audioFormat: AudioFormat;
  audioQuality: AudioQuality;
  downloadParallelism: number;
  outputDir: string;
  initialUrl?: string;
  manifest?: SyncManifest | null;
};

export function App({
  audioFormat,
  audioQuality,
  downloadParallelism,
  outputDir,
  initialUrl,
  manifest,
}: AppProps) {
  const { exit } = useApp();
  const loadingPhaseRef = useRef<Extract<
    Phase,
    { kind: 'loading-playlist' }
  > | null>(null);
  const syncingPhaseRef = useRef<Extract<Phase, { kind: 'syncing' }> | null>(
    null
  );
  const [state, dispatch] = useReducer(
    reducer,
    createInitialState({ initialUrl, manifest })
  );
  const loadingRequestKey =
    state.phase.kind === 'loading-playlist' ? state.phase.url : null;
  const syncRequestKey =
    state.phase.kind === 'syncing'
      ? `${state.phase.playlist.id}:${state.phase.url}`
      : null;

  loadingPhaseRef.current =
    state.phase.kind === 'loading-playlist' ? state.phase : null;
  syncingPhaseRef.current = state.phase.kind === 'syncing' ? state.phase : null;

  useEffect(() => {
    if (!loadingRequestKey) return;

    const phase = loadingPhaseRef.current;
    if (!phase) return;

    const { url } = phase;
    let isActive = true;

    void (async () => {
      try {
        dispatch({
          canRetryInput: phase.canRetryInput,
          url,
          type: 'loading-message',
          isResync: phase.isResync,
          message: 'Validating provider support',
        });
        let validated: Awaited<ReturnType<typeof validateProviderUrl>>;
        try {
          validated = await validateProviderUrl(url);
        } catch (error) {
          if (!isActive) return;

          const message =
            error instanceof Error ? error.message : 'Unknown error';

          if (phase.canRetryInput) {
            dispatch({ type: 'input-error', message });
            return;
          }

          dispatch({ type: 'error', message });
          return;
        }
        if (!isActive) return;

        dispatch({
          canRetryInput: phase.canRetryInput,
          url,
          type: 'loading-message',
          isResync: phase.isResync,
          message: `Fetching ${formatProviderName(validated.provider)} collection metadata`,
        });
        const playlist = await providers[validated.provider].fetch(
          validated.normalizedUrl,
          {}
        );
        if (!isActive) return;

        dispatch({
          url,
          type: 'syncing-start',
          isResync: phase.isResync,
          downloadParallelism,
          playlist,
        });
      } catch (error) {
        if (!isActive) return;

        const message =
          error instanceof Error ? error.message : 'Unknown error';
        dispatch({ type: 'error', message });
      }
    })();

    return () => {
      isActive = false;
    };
  }, [downloadParallelism, loadingRequestKey]);

  useEffect(() => {
    if (!syncRequestKey) return;

    const phase = syncingPhaseRef.current;
    if (!phase) return;

    const { playlist } = phase;
    const controller = new AbortController();
    let isActive = true;

    void (async () => {
      try {
        const summary = await syncPlaylist({
          audioFormat,
          audioQuality,
          downloadParallelism,
          playlist,
          outputRootDir: outputDir,
          signal: controller.signal,
          onProgress: (progress) => {
            if (!isActive) return;
            dispatch({ type: 'sync-progress', progress });
          },
        });

        if (!isActive) return;
        dispatch({
          type: 'done',
          isResync: phase.isResync,
          playlist,
          summary,
        });
      } catch (error) {
        if (!isActive || controller.signal.aborted) return;

        const message =
          error instanceof Error ? error.message : 'Unknown error';
        dispatch({ type: 'error', message });
      }
    })();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [
    audioFormat,
    audioQuality,
    downloadParallelism,
    outputDir,
    syncRequestKey,
  ]);

  useEffect(() => {
    if (state.phase.kind !== 'done' && state.phase.kind !== 'error') {
      return undefined;
    }

    const timeout = setTimeout(() => {
      exit();
    }, 1800);

    return () => clearTimeout(timeout);
  }, [exit, state.phase]);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Hero />

      {state.phase.kind === 'collecting-input' ? (
        <InputScreen
          errorMessage={state.phase.errorMessage}
          outputDir={outputDir}
          url={state.url}
          onChange={(value) => {
            dispatch({ type: 'set-url', value });
          }}
          onSubmit={(value) => {
            dispatch({ type: 'submit-url', value });
          }}
        />
      ) : null}

      {state.phase.kind === 'confirming-resync' ? (
        <ReSyncScreen
          title={`Resync playlist ${state.phase.manifest.playlistTitle}?`}
          description="We've detected an existing playlist manifest in this directory. Press Enter to resync now, or N to continue with the new playlist."
          onSubmit={(value) => {
            dispatch({ type: 'resync-answer', value });
          }}
        />
      ) : null}

      {state.phase.kind === 'loading-playlist' ? (
        <LoadingScreen
          title="Resolving"
          message={state.phase.message}
          url={state.phase.url}
          titleColor="magenta"
          borderColor="magenta"
        />
      ) : null}

      {state.phase.kind === 'syncing' ? (
        <SyncScreen
          outputDir={outputDir}
          playlist={state.phase.playlist}
          progress={state.phase.progress}
          workerSlots={state.phase.workerSlots}
        />
      ) : null}

      {state.phase.kind === 'done' ? (
        <DoneScreen
          isResync={state.phase.isResync}
          playlist={state.phase.playlist}
          progress={state.phase.progress}
          summary={state.phase.summary}
          workerSlots={state.phase.workerSlots}
        />
      ) : null}

      {state.phase.kind === 'error' ? (
        <ErrorScreen message={state.phase.message} />
      ) : null}
    </Box>
  );
}
