/**
 * QFIT Authentication & Role Management Controller
 * Handles credentials verification, role redirection (Student vs Staff),
 * account registration, and password reset.
 */

const AUTH_STORAGE_KEYS = {
  USERS: 'qfit_registered_users',
  CURRENT_USER: 'qfit_current_session_user'
};

const DEFAULT_USERS = [
  {
    id: 'user-staff-1',
    userIdentifier: 'STAFF101',
    fullName: 'Coach J. Miller',
    role: 'staff',
    password: 'staff123',
    email: 'staff@qfit.uwi.edu'
  },
  {
    id: 'user-student-1',
    userIdentifier: '620123456',
    fullName: 'Alaena Sang',
    role: 'student',
    password: 'student123',
    email: 'alaena.sang@mymona.uwi.edu'
  },
  {
    id: 'user-student-2',
    userIdentifier: '620198765',
    fullName: 'Tajae Jacobs',
    role: 'student',
    password: 'student123',
    email: 'tajae.jacobs@mymona.uwi.edu'
  }
];

class QFitAuth {
  constructor() {
    this.initDatabase();
  }

  initDatabase() {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.USERS);
    if (!raw) {
      localStorage.setItem(AUTH_STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
      return;
    }
    try {
      const existing = JSON.parse(raw);
      if (Array.isArray(existing)) {
        let updated = false;
        DEFAULT_USERS.forEach(defUser => {
          const hasUser = existing.some(
            u => u && u.userIdentifier && u.userIdentifier.toUpperCase() === defUser.userIdentifier.toUpperCase()
          );
          if (!hasUser) {
            existing.push(defUser);
            updated = true;
          }
        });
        if (updated) {
          localStorage.setItem(AUTH_STORAGE_KEYS.USERS, JSON.stringify(existing));
        }
      } else {
        localStorage.setItem(AUTH_STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
      }
    } catch {
      localStorage.setItem(AUTH_STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
    }
  }

  getUsers() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEYS.USERS)) || DEFAULT_USERS;
    } catch {
      return DEFAULT_USERS;
    }
  }

  login(userIdentifier, password) {
    const idClean = String(userIdentifier || '').trim().toUpperCase();
    const passClean = String(password || '').trim();

    const users = this.getUsers();
    const match = users.find(u => 
      u.userIdentifier.toUpperCase() === idClean && u.password === passClean
    );

    if (!match) {
      return {
        success: false,
        error: 'Incorrect username or password. Try again.'
      };
    }

    sessionStorage.setItem(AUTH_STORAGE_KEYS.CURRENT_USER, JSON.stringify(match));
    sessionStorage.removeItem('qfit_student_session_active');
    const redirectUrl = match.role === 'staff' ? 'staff.html' : 'student.html';

    return {
      success: true,
      user: match,
      role: match.role,
      redirectUrl: redirectUrl
    };
  }

  register(userData) {
    const users = this.getUsers();
    const idClean = String(userData.userIdentifier || '').trim().toUpperCase();
    const fullNameClean = String(userData.fullName || '').trim();
    const passClean = String(userData.password || '').trim();

    if (!idClean || !fullNameClean || !passClean) {
      return {
        success: false,
        error: 'Please complete all required fields.'
      };
    }

    if (passClean.length < 4) {
      return {
        success: false,
        error: 'Password must be at least 4 characters.'
      };
    }

    const exists = users.find(u => u.userIdentifier.toUpperCase() === idClean);
    if (exists) {
      return {
        success: false,
        error: `An account with ID "${userData.userIdentifier}" is already registered.`
      };
    }

    const newUser = {
      id: 'user-' + Date.now(),
      userIdentifier: idClean,
      fullName: fullNameClean,
      role: userData.role === 'staff' ? 'staff' : 'student',
      password: passClean,
      email: userData.email ? String(userData.email).trim() : `${idClean.toLowerCase()}@qfit.uwi.edu`
    };

    users.push(newUser);
    localStorage.setItem(AUTH_STORAGE_KEYS.USERS, JSON.stringify(users));
    sessionStorage.setItem(AUTH_STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));
    sessionStorage.removeItem('qfit_student_session_active');

    return {
      success: true,
      user: newUser,
      role: newUser.role,
      redirectUrl: newUser.role === 'staff' ? 'staff.html' : 'student.html'
    };
  }

  resetPassword(userIdentifier, newPassword) {
    const idClean = userIdentifier.trim().toUpperCase();
    const users = this.getUsers();
    const user = users.find(u => u.userIdentifier.toUpperCase() === idClean || (u.email && u.email.toUpperCase() === idClean));

    if (!user) {
      return {
        success: false,
        error: `No registered account found matching "${userIdentifier}".`
      };
    }

    user.password = newPassword.trim();
    localStorage.setItem(AUTH_STORAGE_KEYS.USERS, JSON.stringify(users));
    return {
      success: true,
      message: `Password for ${user.fullName} has been reset successfully. You can now log in.`
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
    sessionStorage.removeItem('qfit_student_session_active');
    window.location.href = 'index.html';
  }
}

window.QFitAuth = new QFitAuth();
