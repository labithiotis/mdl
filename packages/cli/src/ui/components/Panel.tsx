import { Box, type BoxProps, Text, type TextProps } from 'ink';
import type { ReactNode } from 'react';

type PanelProps = {
  children: ReactNode;
  title: string;
  titleColor?: TextProps['color'];
} & BoxProps;

export function Panel({
  title,
  titleColor = 'magentaBright',
  children,
  ...props
}: PanelProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      paddingY={0}
      {...props}
    >
      <Text color={titleColor} bold>
        {title}
      </Text>
      {children}
    </Box>
  );
}
