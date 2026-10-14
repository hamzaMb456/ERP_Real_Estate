'use client';

import { useEffect, useState } from 'react';
import { graphql } from '@/lib/graphql';

export type QueryState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

export function useGraphql<T>(query: string, variables?: Record<string, unknown>): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({ status: 'loading' });
  const variablesKey = JSON.stringify(variables ?? {});

  useEffect(() => {
    let active = true;
    graphql<T>(query, JSON.parse(variablesKey) as Record<string, unknown>)
      .then((data) => active && setState({ status: 'success', data }))
      .catch((error: unknown) =>
        active &&
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Erreur inconnue.',
        }),
      );
    return () => {
      active = false;
    };
  }, [query, variablesKey]);

  return state;
}
