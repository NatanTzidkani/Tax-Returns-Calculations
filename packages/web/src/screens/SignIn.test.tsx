import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getMe, listTaxYears, signInWithGoogle } from '../api/client';
import { renderApp } from '../test/render';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return {
    ...actual,
    listTaxYears: vi.fn(),
    getMe: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  };
});

interface FakeOnSuccessArgs {
  credential: string;
}

// @react-oauth/google needs a real Google script/origin to render its
// button; stub it with plain buttons that call the same callback props.
vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: ReactNode }) => children,
  GoogleLogin: ({
    onSuccess,
    onError,
  }: {
    onSuccess: (args: FakeOnSuccessArgs) => void;
    onError: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => onSuccess({ credential: 'fake-id-token' })}>
        fake-google-success
      </button>
      <button type="button" onClick={() => onError()}>
        fake-google-error
      </button>
    </div>
  ),
}));

beforeEach(() => {
  vi.mocked(getMe).mockReset();
  vi.mocked(signInWithGoogle).mockReset();
  vi.mocked(listTaxYears).mockReset().mockResolvedValue([]);
});

describe('SignIn', () => {
  it('renders Hebrew sign-in copy', async () => {
    vi.mocked(getMe).mockResolvedValue(null);
    await renderApp('/sign-in');

    expect(await screen.findByRole('heading', { name: 'התחברות' })).toBeTruthy();
    expect(screen.getByText('התחברו עם חשבון Google כדי להמשיך')).toBeTruthy();
  });

  it('signs in and navigates to the dashboard on a successful Google callback', async () => {
    vi.mocked(getMe).mockResolvedValue({ id: 'u1', email: 'owner@example.com' });
    vi.mocked(signInWithGoogle).mockResolvedValue({ id: 'u1', email: 'owner@example.com' });

    const user = userEvent.setup();
    await renderApp('/sign-in');

    await user.click(await screen.findByRole('button', { name: 'fake-google-success' }));

    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledWith('fake-id-token'));
    expect(await screen.findByRole('heading', { name: 'שנות מס' })).toBeTruthy();
  });

  it('surfaces the backend ApiError message verbatim when signInWithGoogle rejects with 403', async () => {
    vi.mocked(getMe).mockResolvedValue(null);
    vi.mocked(signInWithGoogle).mockRejectedValue(
      new ApiError(403, 'ההתחברות אינה מורשית עבור חשבון Google זה'),
    );

    const user = userEvent.setup();
    await renderApp('/sign-in');

    await user.click(await screen.findByRole('button', { name: 'fake-google-success' }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'ההתחברות אינה מורשית עבור חשבון Google זה',
    );
  });

  it('falls back to the generic Hebrew alert when the rejection has no ApiError message', async () => {
    vi.mocked(getMe).mockResolvedValue(null);
    vi.mocked(signInWithGoogle).mockRejectedValue(new Error('network'));

    const user = userEvent.setup();
    await renderApp('/sign-in');

    await user.click(await screen.findByRole('button', { name: 'fake-google-success' }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'ההתחברות נכשלה. נסו שוב.',
    );
  });

  it('shows a Hebrew alert when Google itself reports an error', async () => {
    vi.mocked(getMe).mockResolvedValue(null);

    const user = userEvent.setup();
    await renderApp('/sign-in');

    await user.click(await screen.findByRole('button', { name: 'fake-google-error' }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'ההתחברות נכשלה. נסו שוב.',
    );
    expect(signInWithGoogle).not.toHaveBeenCalled();
  });
});
