import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('api bootstrap', () => {
  it('exposes a health result', () => {
    expect(createApp().health()).toEqual({ status: 'ok' });
  });
});
