import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getCalculation, updateTaxYearStatus } from './client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('updateTaxYearStatus', () => {
  it('PATCHes /tax-years/:id/status with the shared { status } body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { id: 'ty-1', year: 2024, status: 'filed' }));
    vi.stubGlobal('fetch', fetchMock);

    await updateTaxYearStatus('ty-1', 'filed');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/tax-years/ty-1/status');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ status: 'filed' });
  });

  it('surfaces the server Hebrew {message} on 400 as the ApiError message', async () => {
    const message = 'לא ניתן לעבור מסטטוס "טיוטה" (draft) לסטטוס "הוגש" (filed)';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(400, { message })));

    await expect(updateTaxYearStatus('ty-1', 'filed')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message,
    });
  });
});

describe('getCalculation', () => {
  it('resolves null on 404 (no calculation yet)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(404, { message: 'עדיין לא בוצע חישוב' })),
    );

    await expect(getCalculation('ty-1')).resolves.toBeNull();
  });

  it('rethrows non-404 errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));

    await expect(getCalculation('ty-1')).rejects.toBeInstanceOf(ApiError);
  });
});
