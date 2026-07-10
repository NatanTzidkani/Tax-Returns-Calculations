import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getMe } from './api/client';
import { renderApp } from './test/render';

vi.mock('./api/client');

describe('router auth guard', () => {
  it('redirects an unauthenticated visitor from the dashboard to sign-in', async () => {
    vi.mocked(getMe).mockResolvedValue(null);

    await renderApp('/');

    expect(await screen.findByRole('heading', { name: 'התחברות' })).toBeTruthy();
  });

  it('redirects an unauthenticated visitor from a tax-year detail page to sign-in', async () => {
    vi.mocked(getMe).mockResolvedValue(null);

    await renderApp('/tax-years/ty-2024');

    expect(await screen.findByRole('heading', { name: 'התחברות' })).toBeTruthy();
  });
});
