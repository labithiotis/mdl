import { getProviderUrlValidationError } from '../lib/providers/Providers';
import type {
  PlaylistMetadata,
  SyncManifest,
  SyncProgress,
  SyncSummary,
} from '../lib/types';
import { createWorkerSlots, updateWorkerSlots } from './utils/workerSlots';

export type Phase =
  | { kind: 'collecting-input'; errorMessage?: string }
  | { kind: 'confirming-resync'; manifest: SyncManifest }
  | {
      canRetryInput: boolean;
      isResync: boolean;
      kind: 'loading-playlist';
      url: string;
      message: string;
    }
  | {
      isResync: boolean;
      kind: 'syncing';
      url: string;
      playlist: PlaylistMetadata;
      progress?: SyncProgress;
      workerSlots: ReturnType<typeof createWorkerSlots>;
    }
  | {
      kind: 'done';
      isResync: boolean;
      playlist: PlaylistMetadata;
      progress?: SyncProgress;
      summary: SyncSummary;
      workerSlots: ReturnType<typeof createWorkerSlots>;
    }
  | { kind: 'error'; message: string };

type AppState = {
  url: string;
  phase: Phase;
};

type Action =
  | { type: 'set-url'; value: string }
  | { type: 'submit-url'; value: string }
  | { type: 'input-error'; message: string }
  | { type: 'resync-answer'; value: boolean }
  | {
      canRetryInput: boolean;
      type: 'loading-message';
      isResync: boolean;
      url: string;
      message: string;
    }
  | {
      type: 'syncing-start';
      isResync: boolean;
      downloadParallelism: number;
      url: string;
      playlist: PlaylistMetadata;
    }
  | { type: 'sync-progress'; progress: SyncProgress }
  | {
      type: 'done';
      isResync: boolean;
      playlist: PlaylistMetadata;
      summary: SyncSummary;
    }
  | { type: 'error'; message: string };

export function createInitialState(options: {
  initialUrl?: string;
  manifest?: SyncManifest | null;
}): AppState {
  const { initialUrl, manifest } = options;

  return {
    url: initialUrl ?? '',
    phase: initialUrl
      ? {
          canRetryInput: false,
          isResync: false,
          kind: 'loading-playlist',
          url: initialUrl,
          message: 'Bootstrapping playlist sync',
        }
      : manifest
        ? { kind: 'confirming-resync', manifest }
        : { kind: 'collecting-input' },
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'set-url':
      return {
        ...state,
        url: action.value,
        phase:
          state.phase.kind === 'collecting-input'
            ? { kind: 'collecting-input' }
            : state.phase,
      };
    case 'submit-url': {
      const nextUrl = action.value.trim();
      const validationError = getProviderUrlValidationError(nextUrl);

      if (validationError) {
        return {
          ...state,
          url: '',
          phase: {
            kind: 'collecting-input',
            errorMessage: validationError,
          },
        };
      }

      return {
        ...state,
        url: nextUrl,
        phase: {
          canRetryInput: true,
          isResync: false,
          kind: 'loading-playlist',
          url: nextUrl,
          message: 'Starting playlist lookup',
        },
      };
    }
    case 'input-error':
      return {
        ...state,
        url: '',
        phase: {
          kind: 'collecting-input',
          errorMessage: action.message,
        },
      };
    case 'resync-answer':
      return action.value && state.phase.kind === 'confirming-resync'
        ? {
            ...state,
            url: state.phase.manifest.playlistUrl,
            phase: {
              canRetryInput: false,
              isResync: true,
              kind: 'loading-playlist',
              url: state.phase.manifest.playlistUrl,
              message: 'Starting playlist resync',
            },
          }
        : state;
    case 'loading-message':
      return {
        ...state,
        phase: {
          canRetryInput: action.canRetryInput,
          isResync: action.isResync,
          kind: 'loading-playlist',
          url: action.url,
          message: action.message,
        },
      };
    case 'syncing-start':
      return {
        ...state,
        phase: {
          isResync: action.isResync,
          kind: 'syncing',
          url: action.url,
          playlist: action.playlist,
          workerSlots: createWorkerSlots(
            action.playlist,
            action.downloadParallelism
          ),
        },
      };
    case 'sync-progress':
      return {
        ...state,
        phase:
          state.phase.kind === 'syncing'
            ? {
                ...state.phase,
                progress: action.progress,
                workerSlots: updateWorkerSlots(
                  state.phase.workerSlots,
                  state.phase.playlist,
                  action.progress
                ),
              }
            : state.phase,
      };
    case 'done':
      return {
        ...state,
        phase:
          state.phase.kind === 'syncing'
            ? {
                kind: 'done',
                isResync: action.isResync,
                playlist: action.playlist,
                progress: state.phase.progress,
                summary: action.summary,
                workerSlots: state.phase.workerSlots,
              }
            : {
                kind: 'done',
                isResync: action.isResync,
                playlist: action.playlist,
                progress: undefined,
                summary: action.summary,
                workerSlots: createWorkerSlots(action.playlist, 0),
              },
      };
    case 'error':
      return {
        ...state,
        phase: { kind: 'error', message: action.message },
      };
    default:
      return state;
  }
}
