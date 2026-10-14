'use client';

import { useEffect, useState } from 'react';
import { graphql } from '@/lib/graphql';

export type QueryState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

type Settled<T> = { key: string; state: Exclude<QueryState<T>, { status: 'loading' }> };

export function useGraphql<T>(query: string, variables?: Record<string, unknown>): QueryState<T> {
  const key = query + JSON.stringify(variables ?? {});
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    let active = true;
    graphql<T>(query, variables)
      .then((data) => active && setSettled({ key, state: { status: 'success', data } }))
      .catch((error: unknown) =>
        active &&
        setSettled({
          key,
          state: { status: 'error', message: error instanceof Error ? error.message : 'Erreur inconnue.' },
        }),
      );
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return settled !== null && settled.key === key ? settled.state : { status: 'loading' };
}
