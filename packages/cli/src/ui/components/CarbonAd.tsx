import { fetchAd, type CarbonAd as TCarbonAd } from '@carbonads/sdk';
import { Box, Text, Transform } from 'ink';
import Link from 'ink-link';
import { useEffect, useState } from 'react';

export function CarbonAd() {
  const [ad, setAd] = useState<TCarbonAd | null>(null);

  useEffect(() => {
    fetchAd({ serve: 'CWBDKK7M', placement: 'mdl-cli' }).then(setAd);
  }, []);

  if (!ad) return null;

  const tagline = ad.companyTagline || '';
  const separator = ad.company && tagline ? ' — ' : '';
  const headline = `${ad.company}${separator}${tagline}`;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="magenta"
      paddingX={1}
    >
      {headline ? (
        <Transform transform={trimStart}>
          <Text bold color="magentaBright">
            {headline}
          </Text>
        </Transform>
      ) : null}
      <Transform transform={trimStart}>
        <Text color="magenta">{ad.description.trim()}</Text>
      </Transform>
      {ad.callToAction ? (
        <Link url={ad.link}>
          <Text bold underline color="blueBright">
            {ad.callToAction}
          </Text>
          <Text color="blueBright"> →</Text>
        </Link>
      ) : null}
      <Box
        width="100%"
        justifyContent="flex-end"
        marginBottom={-1}
        paddingRight={1}
      >
        <Text wrap="truncate">ads via Carbon</Text>
      </Box>
    </Box>
  );
}

/** Trim leading whitespace left by wrap-ansi (trim: false) on continuation lines.
 *  ANSI-aware: skips escape sequences so bold/color codes don't block the trim. */
const ansiSgrPrefixPattern = '\\u001B\\[[0-9;]*m';
const leadingAnsiWhitespacePattern = new RegExp(
  `^((?:${ansiSgrPrefixPattern})*)\\s+`
);

const trimStart = (line: string) =>
  line.replace(leadingAnsiWhitespacePattern, '$1');
