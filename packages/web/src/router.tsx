import { QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Link,
  Outlet,
  redirect,
  type RouterHistory,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { getMe, signOut } from './api/client';
import { authQueryKey, useAuth } from './auth/useAuth';
import { Dashboard } from './screens/Dashboard';
import { DocumentReview } from './screens/DocumentReview';
import { Filing } from './screens/Filing';
import { SignIn } from './screens/SignIn';
import { TaxYearDetail } from './screens/TaxYearDetail';

interface RouterContext {
  queryClient: QueryClient;
}

const signOutButtonClasses =
  'inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 ' +
  'text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-100 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 ' +
  'dark:text-neutral-200 dark:hover:bg-neutral-800';

function AuthStatus() {
  const { t } = useTranslation();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const mutation = useMutation({
    mutationFn: signOut,
    // Clearing the me-query hides the header, but the protected route stays
    // mounted (beforeLoad only runs on navigation) — so navigate to /sign-in
    // first (while still mounted), then drop the cached user so any later
    // guard sees a logged-out state.
    onSuccess: async () => {
      await navigate({ to: '/sign-in' });
      queryClient.setQueryData(authQueryKey, null);
    },
  });

  if (!auth.data || pathname === '/sign-in') {
    return null;
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-neutral-600 dark:text-neutral-400">
        {t('auth.signedInAs', { email: auth.data.email })}
      </span>
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className={signOutButtonClasses}
      >
        {t('auth.signOut')}
      </button>
    </div>
  );
}

function RootLayout() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4 dark:border-neutral-800">
          <Link
            to="/"
            className="rounded text-2xl font-bold tracking-tight text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-neutral-100"
          >
            {t('app.title')}
          </Link>
          <AuthStatus />
        </header>
        <Outlet />
      </div>
    </div>
  );
}

const rootRoute = createRootRouteWithContext<RouterContext>()({ component: RootLayout });

/** Redirects to `/sign-in` unless the me-query resolves a user. Shared by
 * every protected route's `beforeLoad`. */
async function requireAuth({ context }: { context: RouterContext }) {
  const user = await context.queryClient.ensureQueryData({
    queryKey: authQueryKey,
    queryFn: getMe,
  });
  if (!user) {
    throw redirect({ to: '/sign-in' });
  }
}

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
  beforeLoad: requireAuth,
});

const taxYearDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tax-years/$taxYearId',
  component: TaxYearDetail,
  beforeLoad: requireAuth,
});

const documentReviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tax-years/$taxYearId/documents/$documentId',
  component: DocumentReview,
  beforeLoad: requireAuth,
});

const filingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tax-years/$taxYearId/filing',
  component: Filing,
  beforeLoad: requireAuth,
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-in',
  component: SignIn,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  taxYearDetailRoute,
  documentReviewRoute,
  filingRoute,
  signInRoute,
]);

export function createAppRouter(history?: RouterHistory, queryClient?: QueryClient) {
  return createRouter({
    routeTree,
    history,
    context: { queryClient: queryClient ?? new QueryClient() },
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
