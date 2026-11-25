/**
 * QFIT Authentication & Role Management Controller
 * Authentication records are managed by the API; only the current session is
 * kept in session storage.
 */

const AUTH_STORAGE_KEYS = {
  CURRENT_USER: 'qfit_current_session_user',
  API_TOKEN: 'qfit_api_token'
};

function normalizeUser(user) {
  if (!user || typeof user !== 'object') return null;
  return {
    ...user,
    userIdentifier: user.userIdentifier ?? user.user_identifier,
    fullName: user.fullName ?? user.full_name
  };
}

class QFitAuth {
  async login(userIdentifier, password) {
    const result = await window.QFitApi.request('login', {
      method: 'POST',
      body: {
        userIdentifier: String(userIdentifier || '').trim().toUpperCase(),
        password: String(password || '').trim()
      },
      reportErrors: false
    });

    if (result?.success === false) {
      return { success: false, error: result.error || 'Incorrect username or password. Try again.' };
    }

    const user = normalizeUser(result?.user || result);
    if (!user || !user.userIdentifier || !user.role) {
      throw new Error('The API login response did not include a valid user.');
    }

    const token = result.access_token || result.accessToken;
    if (token) {
      sessionStorage.setItem(AUTH_STORAGE_KEYS.API_TOKEN, token);
    }
    sessionStorage.setItem(AUTH_STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    sessionStorage.removeItem('qfit_student_session_active');

    return {
      success: true,
      user,
      role: user.role,
      redirectUrl: user.role === 'staff' ? 'staff.html' : 'student.html'
    };
  }

  async register(userData) {
    const idClean = String(userData.userIdentifier || '').trim().toUpperCase();
    const fullNameClean = String(userData.fullName || '').trim();
    const password = String(userData.password || '').trim();

    if (!idClean || !fullNameClean || !password) {
      return { success: false, error: 'Please complete all required fields.' };
    }
    if (password.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters.' };
    }

    const result = await window.QFitApi.request('register', {
      method: 'POST',
      body: {
        ...userData,
        userIdentifier: idClean,
        fullName: fullNameClean,
        password,
        email: userData.email
          ? String(userData.email).trim()
          : `${idClean.toLowerCase()}@qfit.uwi.edu`
      },
      reportErrors: false
    });
    const user = normalizeUser(result?.user || result);
    if (!user || !user.userIdentifier || !user.role) {
      throw new Error('The API registration response did not include a valid user.');
    }

    const token = result.access_token || result.accessToken;
    if (token) {
      sessionStorage.setItem(AUTH_STORAGE_KEYS.API_TOKEN, token);
    }
    sessionStorage.setItem(AUTH_STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    sessionStorage.removeItem('qfit_student_session_active');

    return {
      success: true,
      user,
      role: user.role,
      redirectUrl: user.role === 'staff' ? 'staff.html' : 'student.html'
    };
  }

  async resetPassword(userIdentifier, newPassword) {
    const identifier = String(userIdentifier || '').trim().toUpperCase();
    const password = String(newPassword || '').trim();
    if (!identifier || !password) {
      return { success: false, error: 'Please enter your account ID and a new password.' };
    }

    const result = await window.QFitApi.request('resetPassword', {
      method: 'POST',
      body: { userIdentifier: identifier, newPassword: password },
      reportErrors: false
    });
    return {
      success: result?.success !== false,
      message: result?.message || 'Your password has been reset successfully.',
      error: result?.error
    };
  }

  getCurrentUser() {
    try {
      return JSON.parse(sessionStorage.getItem(AUTH_STORAGE_KEYS.CURRENT_USER));
    } catch {
      return null;
    }
  }

  logout() {
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.CURRENT_USER);
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.API_TOKEN);
    sessionStorage.removeItem('qfit_student_session_active');
    window.location.href = 'index.html';
  }
}

window.QFitAuth = new QFitAuth();
