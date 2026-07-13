import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, signInWithGoogle } from '../api/client';
import { authQueryKey } from '../auth/useAuth';

const panelClasses =
  'rounded-lg border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900';

const alertClasses =
  'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ' +
  'dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300';

const mutedTextClasses = 'text-sm text-neutral-500 dark:text-neutral-400';

export function SignIn() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Holds the Hebrew message to show the user, or null when there's no error.
  // Backend rejections (403 "not authorized", 401…) come through as an
  // ApiError whose `.message` is already the Hebrew server text — surface it
  // verbatim so a rejected re-sign-in after logout is never silent.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (credential: string) => signInWithGoogle(credential),
    onSuccess: async () => {
      setErrorMessage(null);
      await queryClient.invalidateQueries({ queryKey: authQueryKey });
      await navigate({ to: '/' });
    },
    onError: (error) =>
      setErrorMessage(
        error instanceof ApiError && error.message
          ? error.message
          : t('auth.signInError'),
      ),
  });

  return (
    <main className="flex flex-col items-center gap-6 py-16 text-center">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          {t('auth.signInTitle')}
        </h1>
        <p className={`mt-2 ${mutedTextClasses}`}>{t('auth.signInSubtitle')}</p>
      </div>

      <div className={panelClasses}>
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
          <GoogleLogin
            onSuccess={(credentialResponse) => {
              if (!credentialResponse.credential) {
                setErrorMessage(t('auth.signInError'));
                return;
              }
              mutation.mutate(credentialResponse.credential);
            }}
            onError={() => setErrorMessage(t('auth.signInError'))}
            // Never silently re-use the last account: after signing out the
            // owner must be able to pick a Google account, so opt out of
            // automatic selection.
            auto_select={false}
          />
        </GoogleOAuthProvider>
      </div>

      {errorMessage ? (
        <p role="alert" className={alertClasses}>
          {errorMessage}
        </p>
      ) : null}
    </main>
  );
}
