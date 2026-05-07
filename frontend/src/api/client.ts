const EMPLOYER = 'ga_employer_token';
const EMPLOYEE = 'ga_employee_token';

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

async function parseError(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail ?? j);
  } catch {
    return await res.text();
  }
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
  const base = import.meta.env.DEV ? '' : '';
  const res = await fetch(`${base}${path}`, { ...rest, headers: h });
  if (!res.ok) throw new Error(await parseError(res));
  return res;
}
