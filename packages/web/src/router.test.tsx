import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { getMe, listTaxYears, signOut } from './api/client';
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

  it('sends the user to the sign-in screen after signing out (not just clearing the header)', async () => {
    vi.mocked(listTaxYears).mockResolvedValue([]);
    vi.mocked(signOut).mockResolvedValue(undefined);
    // Signed in; logout clears the cached user via setQueryData (no getMe
    // refetch), so the mock can stay the owner throughout.
    vi.mocked(getMe).mockResolvedValue({ id: 'u1', email: 'owner@example.com' });

    const user = userEvent.setup();
    await renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'התנתקות' }));

    expect(await screen.findByRole('heading', { name: 'התחברות' })).toBeTruthy();
    expect(signOut).toHaveBeenCalled();
  });
});
