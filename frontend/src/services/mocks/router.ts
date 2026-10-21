// services/mocks/router.ts
// Bộ định tuyến tối giản cho máy chủ giả: so khớp method + đường dẫn có tham số (/books/:id).
export interface MockContext {
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  token: string | null;
}

export interface MockResult {
  status?: number; // mặc định 200
  message: string;
  data: unknown;
}

export interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  handler: (ctx: MockContext) => MockResult;
}

export const matchRoute = (routes: Route[], method: string, pathname: string) => {
  for (const route of routes) {
    if (route.method !== method) continue;
    const names: string[] = [];
    const pattern = route.path.replace(/:([A-Za-z]+)/g, (_, n: string) => {
      names.push(n);
      return '([^/]+)';
    });
    const m = new RegExp(`^${pattern}/?$`).exec(pathname);
    if (m) return { route, params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
  }
  return null;
};
