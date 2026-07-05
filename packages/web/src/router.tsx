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
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-6">
      <header className="mb-6 border-b border-neutral-200 pb-4">
        <Link to="/" className="text-2xl font-bold text-neutral-900">
          {t('app.title')}
        </Link>
      </header>
      <Outlet />
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
