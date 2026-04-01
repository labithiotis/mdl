import { Text, useInput } from 'ink';
import { useEffect, useState } from 'react';
import { normalizeUrlInput } from '../utils/urlInput';

type UrlInputProps = {
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  value: string;
};

type CursorState = {
  cursorOffset: number;
};

export function UrlInput(props: UrlInputProps) {
  const [cursorState, setCursorState] = useState<CursorState>({
    cursorOffset: props.value.length,
  });

  useEffect(() => {
    setCursorState((previousCursorState) => ({
      cursorOffset: Math.min(
        previousCursorState.cursorOffset,
        props.value.length
      ),
    }));
  }, [props.value]);

  useInput((input, key) => {
    if (
      key.upArrow ||
      key.downArrow ||
      (key.ctrl && input === 'c') ||
      key.tab ||
      (key.shift && key.tab)
    ) {
      return;
    }

    if (key.return) {
      props.onSubmit(normalizeUrlInput(props.value));
      return;
    }

    let nextCursorOffset = cursorState.cursorOffset;
    let nextRawValue = props.value;

    if (key.leftArrow) {
      nextCursorOffset = Math.max(0, cursorState.cursorOffset - 1);
    } else if (key.rightArrow) {
      nextCursorOffset = Math.min(
        props.value.length,
        cursorState.cursorOffset + 1
      );
    } else if (key.backspace || key.delete) {
      if (cursorState.cursorOffset > 0) {
        nextRawValue =
          props.value.slice(0, cursorState.cursorOffset - 1) +
          props.value.slice(cursorState.cursorOffset);
        nextCursorOffset = cursorState.cursorOffset - 1;
      }
    } else {
      nextRawValue =
        props.value.slice(0, cursorState.cursorOffset) +
        input +
        props.value.slice(cursorState.cursorOffset);
      nextCursorOffset = cursorState.cursorOffset + input.length;
    }

    const nextValue = normalizeUrlInput(nextRawValue);
    const clampedCursorOffset = Math.min(nextCursorOffset, nextValue.length);

    setCursorState({
      cursorOffset: clampedCursorOffset,
    });

    if (nextValue !== props.value) {
      props.onChange(nextValue);
    }
  });

  const children = renderValue(props.value, cursorState.cursorOffset);

  return <Text wrap="truncate-middle">{children}</Text>;
}

function renderValue(value: string, cursorOffset: number) {
  if (!value) {
    return <Text inverse> </Text>;
  }

  const beforeCursor = value.slice(0, cursorOffset);
  const cursorCharacter = value[cursorOffset];
  const afterCursor = value.slice(cursorOffset + 1);

  if (cursorOffset === value.length) {
    return [
      <Text key="value">{value}</Text>,
      <Text key="cursor-end" inverse>
        {' '}
      </Text>,
    ];
  }

  return [
    <Text key="before-cursor">{beforeCursor}</Text>,
    <Text key="cursor" inverse>
      {cursorCharacter}
    </Text>,
    <Text key="after-cursor">{afterCursor}</Text>,
  ];
}
