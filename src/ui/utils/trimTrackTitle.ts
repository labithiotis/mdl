export function trimTrackTitle(title: string, maxLength: number): string {
  if (title.length <= maxLength) {
    return title;
  }

  return `${title.slice(0, Math.max(maxLength - 3, 1))}...`;
}
