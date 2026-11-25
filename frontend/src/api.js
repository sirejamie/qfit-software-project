const defaultApiConfig = {
  baseUrl: '/api',
  pollIntervalMs: 5000,
  routes: {
    status: '/gym/status',
    queue: '/gym/active',
    waitlist: '/gym/waitlist',
    settings: '/gym/settings',
    checkIn: '/gym/checkin',
    checkout: '/gym/checkout/{studentId}',
    promote: '/gym/waitlist/{studentId}/promote',
    removeWaitlist: '/gym/waitlist/{studentId}',
    updateWaitlist: '/gym/waitlist/{studentId}',
    resync: '/gym/active/{studentId}/resync',
    reset: '/demo/reset',
    checkoutNotice: '/gym/notices/{studentId}',
    login: '/auth/login',
    register: '/auth/register',
    resetPassword: '/auth/password/reset'
  }
};

const suppliedConfig = window.QFitApiConfig || {};
const apiConfig = {
  ...defaultApiConfig,
  ...suppliedConfig,
  routes: { ...defaultApiConfig.routes, ...(suppliedConfig.routes || {}) }
};

let pendingErrorMessage = null;

function showApiError(message) {
  console.error(`QFit API error: ${message}`);
  if (!document.body) {
    pendingErrorMessage = message;
    return;
  }

  let banner = document.getElementById('qfit-api-error');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'qfit-api-error';
    banner.setAttribute('role', 'alert');
    Object.assign(banner.style, {
      position: 'fixed',
      left: '1rem',
      right: '1rem',
      bottom: '1rem',
      zIndex: '10000',
      padding: '0.85rem 1rem',
      color: '#fff',
      background: '#991b1b',
      borderRadius: '0.5rem',
      font: '600 0.9rem/1.4 sans-serif'
    });
    document.body.appendChild(banner);
  }
  banner.textContent = `Unable to communicate with the QFit API: ${message}`;
}

document.addEventListener('DOMContentLoaded', () => {
  if (pendingErrorMessage) {
    showApiError(pendingErrorMessage);
    pendingErrorMessage = null;
  }
});

function buildUrl(routeName, pathParams = {}) {
  const route = apiConfig.routes[routeName];
  if (typeof route !== 'string' || !route) {
    throw new Error(`No API route is configured for "${routeName}".`);
  }

  const resolvedRoute = route.replace(/\{([^}]+)\}/g, (placeholder, key) => {
    if (pathParams[key] === undefined || pathParams[key] === null) {
      throw new Error(`Missing "${key}" for the "${routeName}" API route.`);
    }
    return encodeURIComponent(pathParams[key]);
  });

  return `${apiConfig.baseUrl.replace(/\/$/, '')}/${resolvedRoute.replace(/^\//, '')}`;
}

async function request(routeName, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = sessionStorage.getItem('qfit_api_token');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let body;
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }

  let response;
  try {
    response = await fetch(buildUrl(routeName, options.pathParams), {
      method: options.method || 'GET',
      headers,
      body
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed.';
    if (options.reportErrors !== false) showApiError(message);
    throw error;
  }

  let responseBody = null;
  if (response.status !== 204) {
    const responseText = await response.text();
    if (responseText) {
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = responseText;
      }
    }
  }

  if (!response.ok) {
    const detail = responseBody && typeof responseBody === 'object'
      ? responseBody.detail || responseBody.error || responseBody.message
      : responseBody;
    const message = detail || `${response.status} ${response.statusText}`;
    const error = new Error(String(message));
    error.status = response.status;
    if (options.reportErrors !== false) showApiError(error.message);
    throw error;
  }

  return responseBody;
}

window.QFitApi = { config: apiConfig, request, showError: showApiError };
