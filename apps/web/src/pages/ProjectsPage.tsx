import { useState, type FormEvent } from 'react';
import { createProject } from '../api-client.js';
import { useProjectContext } from '../project-context.js';

export function ProjectsPage() {
  const { projects, selectedProjectId, selectProject, loading, error, refresh } =
    useProjectContext();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const result = await createProject({ name, slug });
    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error.message);
      return;
    }

    setName('');
    setSlug('');
    refresh();
    selectProject(result.data.id);
  }

  return (
    <section>
      <h2>Projects</h2>

      {loading && <p>Loading projects…</p>}
      {error && <p role="alert">Failed to load projects: {error}</p>}

      {!loading && !error && (
        <ul>
          {projects.map((project) => (
            <li key={project.id}>
              <button
                type="button"
                onClick={() => selectProject(project.id)}
                aria-current={project.id === selectedProjectId}
              >
                {project.name} ({project.slug})
              </button>
            </li>
          ))}
          {projects.length === 0 && <li>No projects yet.</li>}
        </ul>
      )}

      <h3>New project</h3>
      <form onSubmit={handleSubmit}>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Slug
          <input value={slug} onChange={(event) => setSlug(event.target.value)} required />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create project'}
        </button>
        {submitError && <p role="alert">{submitError}</p>}
      </form>
    </section>
  );
}
