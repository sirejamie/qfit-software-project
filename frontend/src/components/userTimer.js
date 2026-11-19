let timerInterval = null;

export function renderUserTimer(container, durationMinutes = 60) {
  // Stop any previous timer
  if (timerInterval !== null) {
    clearInterval(timerInterval);
  }

  // Temporary expiration time for testing
  const expiresAt = Date.now() + durationMinutes * 60 * 1000;
  const totalSeconds = durationMinutes * 60;

  container.innerHTML = `
    <section class="timer-card">
      <h2>My Gym Session</h2>

      <p class="timer-label">Time Remaining</p>

      <div id="timer-display" class="timer-display">
        --:--
      </div>

      <p id="timer-status" class="timer-status">
        Session Active
      </p>

      <div class="timer-progress">
        <div id="timer-progress-fill"></div>
      </div>

      <p id="timer-message" class="timer-message">
        Your gym session is currently active.
      </p>
    </section>
  `;

  const display = container.querySelector("#timer-display");
  const status = container.querySelector("#timer-status");
  const progress = container.querySelector("#timer-progress-fill");
  const message = container.querySelector("#timer-message");

  function updateTimer() {
    const remainingSeconds = Math.max(
      0,
      Math.ceil((expiresAt - Date.now()) / 1000)
    );

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    // Display remaining time
    display.textContent =
      `${String(minutes).padStart(2, "0")}:` +
      `${String(seconds).padStart(2, "0")}`;

    // Update progress bar
    const percentage = totalSeconds > 0
      ? (remainingSeconds / totalSeconds) * 100
      : 0;

    progress.style.width = `${Math.min(100, percentage)}%`;

    // Check session status
    if (remainingSeconds === 0) {
      clearInterval(timerInterval);
      timerInterval = null;

      status.textContent = "Session Expired";
      status.className = "timer-status expired";

      message.textContent =
        "Your gym session has ended. Please exit the gym.";

    } else if (remainingSeconds <= 300) {
      status.textContent = "Session Ending Soon";
      status.className = "timer-status warning";

      message.textContent =
        "You have less than 5 minutes remaining.";

    } else {
      status.textContent = "Session Active";
      status.className = "timer-status";

      message.textContent =
        "Your gym session is currently active.";
    }
  }

  // Update immediately
  updateTimer();

  // Start countdown if session has not expired
  if (Date.now() < expiresAt) {
    timerInterval = setInterval(updateTimer, 1000);
  }
}
