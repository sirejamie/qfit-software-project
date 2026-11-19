import { fetchUserTimer } from "./timerService.js";
let timerInterval = null;
let syncInterval = null;

export async function renderUserTimer(
  container,
  { demo = true, durationMinutes = 60 } = {}
) {
  // Stop any previous timers
  clearInterval(timerInterval);
  clearInterval(syncInterval);

  // Create the timer interface
  container.innerHTML = `
    <section class="timer-card">
      <h2>My Gym Session</h2>

      <p class="timer-label">Time Remaining</p>

      <div id="timer-display" class="timer-display">
        --:--
      </div>

      <p id="timer-status" class="timer-status">
        Loading...
      </p>

      <div class="timer-progress">
        <div id="timer-progress-fill"></div>
      </div>

      <p id="timer-message" class="timer-message"></p>
    </section>
  `;

  const display = container.querySelector("#timer-display");
  const status = container.querySelector("#timer-status");
  const progress = container.querySelector("#timer-progress-fill");
  const message = container.querySelector("#timer-message");

  let expiresAt = null;
  let totalSeconds = durationMinutes * 60;
  let unlimited = false;
  let sessionStatus = "active";
  let syncFailed = false;

  // ------------------------------------
  // 1. UPDATE THE COUNTDOWN DISPLAY
  // ------------------------------------

  function updateTimer() {
    if (sessionStatus === "no_session") {
      display.textContent = "--:--";
      status.textContent = "No Active Session";
      status.className = "timer-status";
      message.textContent =
        "You do not have an active gym session.";
      progress.style.width = "0%";
      return;
    }

    if (unlimited) {
      display.textContent = "Unlimited";
      status.textContent = "Session Active";
      status.className = "timer-status";
      message.textContent =
        "There is currently no time limit.";
      progress.style.width = "100%";
      return;
    }

    if (expiresAt === null) {
      display.textContent = "--:--";
      status.textContent = "Loading...";
      return;
    }

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

    progress.style.width =
      `${Math.min(100, percentage)}%`;

    // Check whether the session has expired
    if (remainingSeconds === 0) {
      status.textContent = "Session Expired";
      status.className = "timer-status expired";

      message.textContent =
        "Your gym session has ended. Please exit the gym.";

      clearInterval(timerInterval);
      timerInterval = null;

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

    // Show a warning if server synchronization fails
    if (syncFailed && remainingSeconds > 0) {
      message.textContent +=
        " Connection lost. Using last known timer.";
    }
  }

  // ------------------------------------
  // 2. START THE COUNTDOWN
  // ------------------------------------

  function startCountdown() {
    clearInterval(timerInterval);
    timerInterval = null;

    updateTimer();

    if (!unlimited && expiresAt > Date.now()) {
      timerInterval = setInterval(updateTimer, 1000);
    }
  }

  // ------------------------------------
  // 3. DEMO MODE
  // ------------------------------------

  if (demo) {
    expiresAt =
      Date.now() + durationMinutes * 60 * 1000;

    startCountdown();
    return;
  }

  // ------------------------------------
  // 4. LIVE MODE
  // ------------------------------------

  async function synchronizeTimer() {
    try {
      // Retrieve timer information from Python
      const data = await fetchUserTimer();

      syncFailed = false;
      sessionStatus = data.status;

      // Check for an active gym session
      if (data.status === "no_session") {
        clearInterval(timerInterval);
        timerInterval = null;
        updateTimer();
        return;
      }

      // Check whether the session is unlimited
      unlimited = data.expires_at === null;

      if (!unlimited) {
        // Use the expiration time stored in Supabase
        expiresAt = new Date(
          data.expires_at
        ).getTime();

        // Calculate the full session duration
        const startTime = new Date(
          data.start_time
        ).getTime();

        totalSeconds = Math.max(
          1,
          (expiresAt - startTime) / 1000
        );
      }

      startCountdown();

    } catch (error) {
      console.error(
        "Timer synchronization failed:",
        error
      );

      syncFailed = true;

      if (expiresAt !== null) {
        updateTimer();
      } else {
        display.textContent = "--:--";
        status.textContent = "Connection Error";
        status.className = "timer-status expired";

        message.textContent =
          "Unable to load your gym session.";
      }
    }
  }

  // Synchronize immediately
  await synchronizeTimer();

  // Synchronize every 30 seconds
  syncInterval = setInterval(
    synchronizeTimer,
    30000
  );
}
