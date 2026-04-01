const HTTP_URL_PATTERN = /https?:\/\/[^\s"'<>]+/i;

export function normalizeUrlInput(value: string): string {
  const normalizedValue = value.replace(/\r\n?/g, '\n');
  const matchedUrl = normalizedValue.match(HTTP_URL_PATTERN)?.[0];

  if (matchedUrl) {
    return matchedUrl.trim();
  }

  return normalizedValue.replace(/\s+/g, '');
}
