import { useCallback, useEffect, useState } from 'react';

/** Kleine data-hook: laadt, herlaadt en houdt fouten zichtbaar in plaats van stil. */
export function useData<T>(laad: () => Promise<T>, sleutels: unknown[] = []) {
  const [data, setData] = useState<T | undefined>();
  const [fout, setFout] = useState<string | undefined>();
  const [bezig, setBezig] = useState(true);

  const herlaad = useCallback(() => {
    setBezig(true);
    laad()
      .then((d) => { setData(d); setFout(undefined); })
      .catch((e: Error) => setFout(e.message))
      .finally(() => setBezig(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, sleutels);

  useEffect(herlaad, [herlaad]);
  return { data, fout, bezig, herlaad, setData };
}
