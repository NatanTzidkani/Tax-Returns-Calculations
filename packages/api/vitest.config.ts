import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // App boot + real-Postgres integration tests run on a slow bind-mounted
    // filesystem in the dev container; the vitest defaults (5s/10s) flake.
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // Root cause of the session.test.ts 13-20s+ flake (and, under heavy load,
    // outright RED failures — signInAndGetCookie 500s): the default `forks`
    // pool spawns one process per test file (up to nproc = 8 here), and every
    // one simultaneously cold-loads the full app graph (secure-session →
    // sodium-native → drizzle) off the slow 9p bind mount AND opens its own pg
    // connection pool. That peak contention — I/O on the mount plus Postgres
    // connections — is what spikes/breaks the suite.
    //
    // We keep `forks` (real process isolation for the five real-Postgres suites,
    // each of which DROP/CREATEs its own dedicated database) but bound the pool
    // so at most `maxForks` processes cold-load at once. `threads` was tried and
    // rejected: it shares one event loop, measured SLOWER here (~170s vs the
    // ~121s best-case forks run), and pushes every native-addon load + pg pool
    // into a single process — the opposite of what the DB suites want.
    //
    // maxForks=4 (half of nproc) is the balance point: peak cold-load/connection
    // contention stays well under the flake threshold, while the five DB suites
    // still parallelize (~two waves instead of eight-at-once). The suites never
    // collide despite sharing the fork pool because each already uses a DISTINCT
    // test database (taxreturns_test / _confirmed_data / _credit_points /
    // _document_deletion / _profile).
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 4,
        minForks: 1,
      },
    },
  },
});
