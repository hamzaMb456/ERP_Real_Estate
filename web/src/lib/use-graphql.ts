'use client';

import { useEffect, useState } from 'react';
import { graphql } from '@/lib/graphql';

type QueryState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T };

export function useGraphql<T>(query: string): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    graphql<T>(query)
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
  }, [query]);

  return state;
}
