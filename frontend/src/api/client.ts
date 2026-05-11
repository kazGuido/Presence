const EMPLOYER = 'ga_employer_token';
const EMPLOYEE = 'ga_employee_token';
const SUPER_ADMIN = 'ga_super_admin_token';

export function getEmployerToken(): string | null {
  return localStorage.getItem(EMPLOYER);
}

export function setEmployerToken(t: string | null) {
  if (t) localStorage.setItem(EMPLOYER, t);
  else localStorage.removeItem(EMPLOYER);
}

export function getEmployeeToken(): string | null {
  return localStorage.getItem(EMPLOYEE);
}

export function setEmployeeToken(t: string | null) {
  if (t) localStorage.setItem(EMPLOYEE, t);
  else localStorage.removeItem(EMPLOYEE);
}

export function getSuperAdminToken(): string | null {
  return localStorage.getItem(SUPER_ADMIN);
}

export function setSuperAdminToken(t: string | null) {
  if (t) localStorage.setItem(SUPER_ADMIN, t);
  else localStorage.removeItem(SUPER_ADMIN);
}

async function parseError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    return typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail ?? j);
  } catch {
    return text || res.statusText;
  }
}

/** Empty in web Docker build (same-origin). Set `VITE_API_URL` for Capacitor/static hosting off-origin. */
export function getApiBaseUrl(): string {
  const v = import.meta.env.VITE_API_URL;
  if (typeof v === 'string' && v.trim()) return v.replace(/\/$/, '');
  return '';
}

export async function apiFetch(
  path: string,
  opts: RequestInit & { token?: string | null } = {}
): Promise<Response> {
  const { token, headers, ...rest } = opts;
  const h = new Headers(headers);
  const auth = token !== undefined ? token : getEmployerToken() ?? getEmployeeToken();
  if (auth) h.set('Authorization', `Bearer ${auth}`);
  if (!h.has('Content-Type') && rest.body && !(rest.body instanceof FormData)) {
    h.set('Content-Type', 'application/json');
  }
  const base = getApiBaseUrl();
  const url = path.startsWith('http') ? path : `${base}${path}`;
  const res = await fetch(url, { ...rest, headers: h });
  if (!res.ok) throw new Error(await parseError(res));
  return res;
}
