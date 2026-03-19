const normalizePathname = (pathname: string): string => {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
};

const matchesPathPrefix = (pagePathname: string, basePathname: string): boolean => {
  if (basePathname === '/') {
    return true;
  }

  return pagePathname === basePathname || pagePathname.startsWith(`${basePathname}/`);
};

export const matchesBaseUrl = (pageUrl: string, baseUrl: string): boolean => {
  try {
    const page = new URL(pageUrl);
    const base = new URL(baseUrl);

    if (page.origin !== base.origin) {
      return false;
    }

    return matchesPathPrefix(normalizePathname(page.pathname), normalizePathname(base.pathname));
  } catch (error) {
    console.warn('Unable to compare URLs for a banner-block rule.', error);
    return false;
  }
};
