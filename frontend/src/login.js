/**
 * QFIT Login Page Controller
 * Handles split-screen login, authentication check, error highlighting,
 * and registration/reset modals.
 */

document.addEventListener('DOMContentLoaded', () => {
  const formLogin = document.getElementById('form-login');
  const inputLoginId = document.getElementById('login-id');
  const inputLoginPass = document.getElementById('login-password');
  const errorBanner = document.getElementById('login-error-banner');
  const errorText = document.getElementById('login-error-text');
  const successBanner = document.getElementById('login-success-banner');
  const successText = document.getElementById('login-success-text');

  // Quick-fill buttons
  const btnStaff = document.getElementById('btn-quick-staff');
  const btnStudent = document.getElementById('btn-quick-student');
  const btnStudent2 = document.getElementById('btn-quick-student-2');

  if (btnStaff) {
    btnStaff.addEventListener('click', () => {
      inputLoginId.value = 'STAFF101';
      inputLoginPass.value = 'staff123';
      clearErrors();
      inputLoginId.focus();
    });
  }

  if (btnStudent) {
    btnStudent.addEventListener('click', () => {
      inputLoginId.value = '620123456';
      inputLoginPass.value = 'student123';
      clearErrors();
      inputLoginId.focus();
    });
  }

  if (btnStudent2) {
    btnStudent2.addEventListener('click', () => {
      inputLoginId.value = '620198765';
      inputLoginPass.value = 'student123';
      clearErrors();
      inputLoginId.focus();
    });
  }

  function clearErrors() {
    if (errorBanner) errorBanner.style.display = 'none';
    if (successBanner) successBanner.style.display = 'none';
    if (inputLoginId) inputLoginId.classList.remove('is-invalid');
    if (inputLoginPass) inputLoginPass.classList.remove('is-invalid');
  }

  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      const id = inputLoginId.value.trim();
      const pass = inputLoginPass.value.trim();

      let result;
      try {
        result = await window.QFitAuth.login(id, pass);
      } catch (error) {
        result = { success: false, error: error.message || 'Unable to sign in.' };
      }

      if (result.success) {
        successText.textContent = `Successfully signed in as ${result.user.fullName}`;
        successBanner.style.display = 'flex';
        setTimeout(() => {
          window.location.href = result.redirectUrl;
        }, 600);
      } else {
        errorText.textContent = result.error;
        errorBanner.style.display = 'flex';
        inputLoginId.classList.add('is-invalid');
        inputLoginPass.classList.add('is-invalid');
      }
    });
  }
});
