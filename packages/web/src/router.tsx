import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  type RouterHistory,
} from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Dashboard } from './screens/Dashboard';
import { TaxYearDetail } from './screens/TaxYearDetail';

function RootLayout() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <header className="mb-8 border-b border-neutral-200 pb-4 dark:border-neutral-800">
          <Link
            to="/"
            className="rounded text-2xl font-bold tracking-tight text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-neutral-100"
          >
            {t('app.title')}
          </Link>
        </header>
        <Outlet />
      </div>
    </div>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
});

const taxYearDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tax-years/$taxYearId',
  component: TaxYearDetail,
});

const routeTree = rootRoute.addChildren([dashboardRoute, taxYearDetailRoute]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, history });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
