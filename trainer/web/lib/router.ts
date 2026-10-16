import { useEffect, useState } from 'react';

export interface Route {
  path: string; // e.g. "/result/abc"
  parts: string[]; // ["result", "abc"]
  query: URLSearchParams;
}

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [p, q = ''] = raw.split('?');
  const path = p.startsWith('/') ? p : `/${p}`;
  return { path, parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    let lastPath = parse().path;
    const on = () => {
      const next = parse();
      setRoute(next);
      if (next.path !== lastPath) window.scrollTo({ top: 0 });
      lastPath = next.path;
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const hash = to.startsWith('#') ? to : `#${to}`;
  if (opts.replace) window.location.replace(hash);
  else window.location.hash = hash;
}

export function href(to: string): string {
  return to.startsWith('#') ? to : `#${to}`;
}
