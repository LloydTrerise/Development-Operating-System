import { useEffect, useState } from 'react';
import { searchProject, type ProjectSearchResults } from '../../api-client.js';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/**
 * DEVOS-264/265: a single, shared debounced-search hook (mirroring
 * `useWorkflowGraphValidation`'s established `DEBOUNCE_MS` convention) —
 * both the top-bar `GlobalSearch` and the `CommandPalette` call this exact
 * same hook rather than each implementing their own fetch/debounce logic,
 * per this sprint's own "single implementation" scope note.
 */
export function useProjectSearch(
  projectId: string | null,
  query: string,
): { results: ProjectSearchResults | null; loading: boolean; error: string | null } {
  const [results, setResults] = useState<ProjectSearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!projectId || trimmed.length < MIN_QUERY_LENGTH) {
      setResults(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      searchProject(projectId, trimmed).then((result) => {
        setLoading(false);
        if (result.ok) {
          setError(null);
          setResults(result.data);
        } else {
          setError(result.error.message);
          setResults(null);
        }
      });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [projectId, query]);

  return { results, loading, error };
}
