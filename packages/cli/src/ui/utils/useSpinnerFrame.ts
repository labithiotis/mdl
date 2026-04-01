import { useEffect, useState } from 'react';

export function useSpinnerFrame(): string {
  const frames = ['-', '\\', '|', '/'];
  const [index, setIndex] = useState(0);
  const frameCount = frames.length;

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % frameCount);
    }, 90);

    return () => clearInterval(timer);
  }, [frameCount]);

  return frames[index] ?? frames[0] ?? '-';
}
