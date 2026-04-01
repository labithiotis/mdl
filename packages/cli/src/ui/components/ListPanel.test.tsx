import { afterEach, describe, expect, test } from 'bun:test';
import { render } from 'ink-testing-library';
import type { WorkerSlotState } from '../types';
import { ListPanel } from './ListPanel';
import { WorkerRow } from './WorkerRow';

describe('ListPanel', () => {
  afterEach(() => {
    process.stdout.rows = ORIGINAL_STDOUT_ROWS;
  });

  test('scrolls long lists down and back to the top', async () => {
    process.stdout.rows = 12;

    const app = render(
      <ListPanel
        items={createSlots(18)}
        minRows={4}
        renderItem={(slot) => <WorkerRow key={slot.trackId} slot={slot} />}
        title="Tracks"
        viewportHeight={4}
      />
    );

    await waitForFrame(app.lastFrame, (frame) => frame.includes('Track 01'));
    expect(app.lastFrame()).toContain('Scroll:');
    expect(app.lastFrame()).not.toContain('Track 12');

    for (let index = 0; index < 8; index += 1) {
      app.stdin.write('\u001B[B');
    }

    await waitForFrame(app.lastFrame, (frame) => frame.includes('Track 09'));
    expect(app.lastFrame()).not.toContain('Track 01');

    for (let index = 0; index < 8; index += 1) {
      app.stdin.write('\u001B[A');
    }

    await waitForFrame(app.lastFrame, (frame) => frame.includes('Track 01'));
    expect(app.lastFrame()).not.toContain('Track 09');

    app.unmount();
  });
});

const ORIGINAL_STDOUT_ROWS = process.stdout.rows;

function createSlots(count: number): WorkerSlotState[] {
  return Array.from({ length: count }, (_unused, index) => ({
    isActive: false,
    message: 'Queued',
    stage: 'queued',
    title: `Track ${String(index + 1).padStart(2, '0')}`,
    trackId: `track-${index + 1}`,
    trackIndex: index + 1,
    visible: true,
  }));
}

async function waitForFrame(
  getFrame: () => string | undefined,
  predicate: (frame: string) => boolean,
  timeoutMs = 2_000
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const frame = getFrame();

    if (frame && predicate(frame)) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
  }

  throw new Error('Timed out waiting for the expected frame.');
}
