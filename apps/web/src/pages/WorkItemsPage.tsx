import { useEffect, useState, type FormEvent } from 'react';
import { createWorkItem, listWorkItems, type WorkItem } from '../api-client.js';
import { useProjectContext } from '../project-context.js';

export function WorkItemsPage() {
  const { selectedProjectId } = useProjectContext();
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!selectedProjectId) {
      setWorkItems([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    listWorkItems(selectedProjectId).then((result) => {
      if (cancelled) return;
      setLoading(false);

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      setError(null);
      setWorkItems(result.data);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, reloadToken]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedProjectId) return;

    setSubmitting(true);
    setSubmitError(null);

    const result = await createWorkItem(selectedProjectId, { title });
    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error.message);
      return;
    }

    setTitle('');
    setReloadToken((token) => token + 1);
  }

  if (!selectedProjectId) {
    return (
      <section>
        <h2>Work Items</h2>
        <p>Select a project to see its work items.</p>
      </section>
    );
  }

  return (
    <section>
      <h2>Work Items</h2>

      {loading && <p>Loading work items…</p>}
      {error && <p role="alert">Failed to load work items: {error}</p>}

      {!loading && !error && (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Priority</th>
            </tr>
          </thead>
          <tbody>
            {workItems.map((workItem) => (
              <tr key={workItem.id}>
                <td>{workItem.title}</td>
                <td>{workItem.type}</td>
                <td>{workItem.status}</td>
                <td>{workItem.priority}</td>
              </tr>
            ))}
            {workItems.length === 0 && (
              <tr>
                <td colSpan={4}>No work items yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <h3>New work item</h3>
      <form onSubmit={handleSubmit}>
        <label>
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create work item'}
        </button>
        {submitError && <p role="alert">{submitError}</p>}
      </form>
    </section>
  );
}
