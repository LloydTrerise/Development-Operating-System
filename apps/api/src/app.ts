export function createApp(): { health: () => { status: 'ok' } } {
  return { health: () => ({ status: 'ok' }) };
}
