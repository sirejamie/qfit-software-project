/**
 * QFIT User Portal Controller
 * Implements QR Scanner, Live Camera Stream, Demo Skip, Synced Workout Timer, and Waitlist.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Authentication Check
  const authUser = window.QFitAuth ? window.QFitAuth.getCurrentUser() : null;
  const headerName = document.getElementById('user-header-name');
  const scannerMemberName = document.getElementById('scanner-member-name');
  const btnLogout = document.getElementById('btn-user-logout');

  const userProfile = authUser ? {
    fullName: authUser.fullName,
    userId: authUser.userIdentifier,
    durationMinutes: 60
  } : {
    fullName: 'Alaena Sang',
    userId: '620123456',
    durationMinutes: 60
  };

  if (headerName) headerName.textContent = `👤 ${userProfile.fullName}`;
  if (scannerMemberName) scannerMemberName.textContent = userProfile.fullName;

  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      stopCamera();
      sessionStorage.removeItem('qfit_user_session_active');
      window.QFitAuth.logout();
    });
  }

  // Views
  const viewScanner = document.getElementById('view-scanner');
  const viewTimer = document.getElementById('view-timer');
  const viewWaitlist = document.getElementById('view-waitlist');

  // Scanner elements
  const btnSkipScan = document.getElementById('btn-skip-scan');
  const btnTriggerCamera = document.getElementById('btn-trigger-camera');
  const btnConfirmCameraScan = document.getElementById('btn-confirm-camera-scan');
  const btnRetryScan = document.getElementById('btn-retry-scan');
  const alertScanFailed = document.getElementById('alert-scan-failed');
  const scanFailReason = document.getElementById('scan-fail-reason');
  const alertCameraError = document.getElementById('alert-camera-error');
  const cameraErrorReason = document.getElementById('camera-error-reason');
  const cameraNewtabWrap = document.getElementById('camera-newtab-wrap');
  const scannerBox = document.getElementById('scanner-box');
  const scannerVideo = document.getElementById('scanner-video');
  const scannerPlaceholder = document.getElementById('scanner-placeholder');

  // Timer elements
  const timerUserName = document.getElementById('timer-user-name');
  const timerUserDetails = document.getElementById('timer-user-details');
  const userCountdownText = document.getElementById('user-countdown-text');
  const userTimerStatusText = document.getElementById('user-timer-status-text');
  const userTimerCircle = document.getElementById('user-timer-circle');
  const alertTimerDesync = document.getElementById('alert-timer-desync');
  const btnUserResync = document.getElementById('btn-user-resync');
  const alertQueueSuccess = document.getElementById('alert-queue-success');
  const alertQueueRemoved = document.getElementById('alert-queue-removed');
  const queueRemovedText = document.getElementById('queue-removed-text');
  const btnCheckoutSession = document.getElementById('btn-checkout-session');

  // Waitlist elements
  const waitlistPosNumber = document.getElementById('waitlist-pos-number');
  const waitlistAheadText = document.getElementById('waitlist-ahead-text');
  const waitlistEstTime = document.getElementById('waitlist-est-time');
  const waitlistReadyBanner = document.getElementById('waitlist-ready-banner');
  const btnClaimSlot = document.getElementById('btn-claim-slot');
  const btnLeaveWaitlist = document.getElementById('btn-leave-waitlist');
  const checkNotify5Min = document.getElementById('check-notify-5min');
  const btnSimulate5MinNotify = document.getElementById('btn-simulate-5min-notify');

  // Toast Notification elements
  const toastEl = document.getElementById('qfit-toast-notification');
  const toastIcon = document.getElementById('qfit-toast-icon');
  const toastTitle = document.getElementById('qfit-toast-title');
  const toastMessage = document.getElementById('qfit-toast-message');
  const toastClose = document.getElementById('qfit-toast-close');

  let currentActiveUser = null;
  let timerInterval = null;
  let cameraStream = null;
  let qrDetectInterval = null;
  let toastAutoHideTimeout = null;
  let waitlistNotifySimTimeout = null;
  let hasShownWaitlist5MinPopup = false;

  function showNotificationPopup(title, message, icon = '🔔') {
    if (!toastEl) return;
    if (toastAutoHideTimeout) clearTimeout(toastAutoHideTimeout);

    if (toastIcon) toastIcon.textContent = icon;
    if (toastTitle) toastTitle.textContent = title;
    if (toastMessage) toastMessage.textContent = message;

    // Re-trigger animation cleanly
    toastEl.style.display = 'none';
    void toastEl.offsetWidth;
    toastEl.style.display = 'flex';

    toastAutoHideTimeout = setTimeout(() => {
      hideNotificationPopup();
    }, 8000);
  }

  function hideNotificationPopup() {
    if (toastEl) {
      toastEl.style.display = 'none';
    }
    if (toastAutoHideTimeout) {
      clearTimeout(toastAutoHideTimeout);
      toastAutoHideTimeout = null;
    }
  }

  if (toastClose) {
    toastClose.addEventListener('click', hideNotificationPopup);
  }

  function showQueueRemovedMessage(message) {
    if (alertQueueRemoved && queueRemovedText) {
      queueRemovedText.textContent = message || 'You have been removed from the queue.';
      alertQueueRemoved.style.display = 'flex';
    }
  }

  function hideQueueRemovedMessage() {
    if (alertQueueRemoved) {
      alertQueueRemoved.style.display = 'none';
    }
  }

  // 2. Initial State: Always show QR Scanner when arriving / signing in
  async function evaluateCurrentState() {
    const isSessionActive = sessionStorage.getItem('qfit_user_session_active') === 'true';
    const queue = window.QFitStore.getQueue();
    const waitlist = window.QFitStore.getWaitlist();
    const pendingNotice = window.QFitStore.consumeCheckoutNotice
      ? await window.QFitStore.consumeCheckoutNotice(userProfile.userId)
      : null;

    // If user explicitly scanned and joined during this session:
    if (isSessionActive) {
      const inQueue = queue.find(s => s.userId === userProfile.userId);
      if (inQueue) {
        currentActiveUser = inQueue;
        showActiveTimer(inQueue);
        return;
      }

      const inWait = waitlist.find(s => s.userId === userProfile.userId);
      if (inWait) {
        showWaitlist(inWait);
        return;
      }
    }

    // Default upon signing in: Show QR Scanner Page
    showScanner();
    if (pendingNotice) {
      showQueueRemovedMessage(pendingNotice.message);
    }
  }

  function showScanner() {
    if (timerInterval) clearInterval(timerInterval);
    if (waitlistNotifySimTimeout) clearTimeout(waitlistNotifySimTimeout);
    currentActiveUser = null;
    hasShownWaitlist5MinPopup = false;
    sessionStorage.removeItem('qfit_user_session_active');

    viewScanner.style.display = 'block';
    viewTimer.style.display = 'none';
    viewWaitlist.style.display = 'none';
  }

  const scannerLaser = document.getElementById('scanner-laser');

  // 3. Camera Scanner & Live Stream Handling
  async function startCamera() {
    if (cameraStream) {
      stopCamera();
      return;
    }

    if (alertCameraError) alertCameraError.style.display = 'none';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showCameraError('Camera API is not supported in this browser or context (requires HTTPS).');
      return;
    }

    btnTriggerCamera.textContent = 'Requesting Camera Access...';
    btnTriggerCamera.disabled = true;

    try {
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
      } catch (constraintErr) {
        // Retry with generic video constraint if rear/environment constraint is unavailable
        if (constraintErr && (constraintErr.name === 'OverconstrainedError' || constraintErr.name === 'NotFoundError')) {
          cameraStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        } else {
          throw constraintErr;
        }
      }

      if (scannerBox) {
        scannerBox.style.background = '#18181b';
        scannerBox.style.border = '3px dashed var(--primary-500)';
      }

      scannerVideo.muted = true;
      scannerVideo.playsInline = true;
      scannerVideo.srcObject = cameraStream;
      scannerVideo.style.display = 'block';
      scannerPlaceholder.style.display = 'none';
      if (scannerLaser) scannerLaser.style.display = 'block';

      try {
        await scannerVideo.play();
      } catch (playErr) {
        console.warn('Video play warning:', playErr);
      }

      btnTriggerCamera.textContent = 'Close Camera';
      btnTriggerCamera.className = 'btn btn-secondary btn-block';
      btnTriggerCamera.disabled = false;

      if (btnConfirmCameraScan) {
        btnConfirmCameraScan.style.display = 'block';
      }

      startQrDetectionLoop();
    } catch (err) {
      console.warn('Camera access not available or permission denied:', err);
      stopCamera();

      let reason = 'Unable to access your device camera. Please allow camera permissions in your browser and try again.';
      const errMsg = err && err.message ? err.message : '';
      if (err && err.name === 'NotAllowedError') {
        if (errMsg.toLowerCase().includes('policy') || window.self !== window.top) {
          reason = 'Camera access was blocked by the browser or embedded preview frame. Allow Camera permissions in your browser address bar, or open the scanner in a new tab.';
        } else {
          reason = 'Camera permission was denied. Please enable camera access in your browser site settings and click Open Camera Scanner again.';
        }
      } else if (err && err.name === 'NotFoundError') {
        reason = 'No camera device was detected on this device. Connect a camera or use Skip QR Scanner below.';
      } else if (err && err.name === 'NotReadableError') {
        reason = 'Your camera is currently in use by another application. Close the other app and try again.';
      }
      showCameraError(reason, err && err.name === 'NotAllowedError' && window.self !== window.top);
    }
  }

  function showCameraError(reason, showNewTabLink = false) {
    if (cameraErrorReason) cameraErrorReason.textContent = reason;
    if (cameraNewtabWrap) cameraNewtabWrap.style.display = showNewTabLink ? 'block' : 'none';
    if (alertCameraError) alertCameraError.style.display = 'flex';
  }

  function startQrDetectionLoop() {
    if (qrDetectInterval) {
      clearInterval(qrDetectInterval);
      qrDetectInterval = null;
    }
    if (typeof window.BarcodeDetector === 'undefined') return;

    let detector;
    try {
      detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    } catch {
      return;
    }

    qrDetectInterval = setInterval(async () => {
      if (!cameraStream || !scannerVideo || scannerVideo.readyState < 2) return;
      try {
        const codes = await detector.detect(scannerVideo);
        if (codes && codes.length > 0) {
          stopCamera();
          processQueueEntry();
        }
      } catch {
        // Ignore transient frame detection errors
      }
    }, 350);
  }

  function stopCamera() {
    if (qrDetectInterval) {
      clearInterval(qrDetectInterval);
      qrDetectInterval = null;
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    if (scannerVideo) {
      scannerVideo.srcObject = null;
      scannerVideo.style.display = 'none';
    }
    if (scannerLaser) scannerLaser.style.display = 'none';
    if (scannerPlaceholder) scannerPlaceholder.style.display = 'flex';
    if (scannerBox) {
      scannerBox.style.background = '#ffffff';
      scannerBox.style.border = '2px solid var(--gray-200)';
    }
    if (btnConfirmCameraScan) {
      btnConfirmCameraScan.style.display = 'none';
    }
    if (btnTriggerCamera) {
      btnTriggerCamera.textContent = 'Open Camera Scanner';
      btnTriggerCamera.className = 'btn btn-secondary btn-block';
      btnTriggerCamera.disabled = false;
    }
  }

  btnTriggerCamera.addEventListener('click', () => {
    startCamera();
  });

  if (btnConfirmCameraScan) {
    btnConfirmCameraScan.addEventListener('click', async () => {
      stopCamera();
      await processQueueEntry();
    });
  }

  // Skip feature for live demo (adds user to queue immediately)
  btnSkipScan.addEventListener('click', async () => {
    stopCamera();
    await processQueueEntry();
  });

  btnRetryScan.addEventListener('click', async () => {
    window.QFitStore.setSimulateQueueFailure(false);
    await processQueueEntry();
  });

  // 4. Process Queue Addition (F-01)
  async function processQueueEntry() {
    alertScanFailed.style.display = 'none';
    hideQueueRemovedMessage();

    let result;
    try {
      result = await window.QFitStore.addUser({
        ...userProfile,
        notify5MinBefore: checkNotify5Min ? checkNotify5Min.checked : true
      });
    } catch (error) {
      scanFailReason.textContent = error.message || 'System failed to add you to the queue. Please scan the QR code again.';
      alertScanFailed.style.display = 'flex';
      return;
    }

    if (result.success) {
      sessionStorage.setItem('qfit_user_session_active', 'true');

      if (result.status === 'active') {
        currentActiveUser = result.user;
        alertQueueSuccess.style.display = 'flex';
        setTimeout(() => {
          alertQueueSuccess.style.display = 'none';
        }, 3500);
        showActiveTimer(result.user);
      } else if (result.status === 'waitlist') {
        showWaitlist(result.user);
      }
    } else {
      // Sync failed -> Prompt to rescan (F-01 SR-2, AC-2)
      scanFailReason.textContent = result.message || 'System failed to add you to the queue. Please scan the QR code again.';
      alertScanFailed.style.display = 'flex';
    }
  }

  // 5. Active Timer UI (F-02)
  function showActiveTimer(user) {
    if (timerInterval) clearInterval(timerInterval);
    stopCamera();

    viewScanner.style.display = 'none';
    viewWaitlist.style.display = 'none';
    viewTimer.style.display = 'block';

    timerUserName.textContent = user.fullName;
    timerUserDetails.textContent = `ID: ${user.userId}`;

    async function tick() {
      const queue = window.QFitStore.getQueue();
      const updated = queue.find(s => s.id === user.id || s.userId === user.userId);

      if (!updated) {
        clearInterval(timerInterval);
        if (window.QFitStore.consumeCheckoutNotice) {
          await window.QFitStore.consumeCheckoutNotice(userProfile.userId);
        }
        showScanner();
        showQueueRemovedMessage('You have been removed from the queue.');
        return;
      }

      // Check desync status (F-02 SR-3)
      if (updated.syncFailed) {
        alertTimerDesync.style.display = 'flex';
      } else {
        alertTimerDesync.style.display = 'none';
      }

      const elapsedMs = Date.now() - updated.joinedAt;
      const totalMs = updated.durationMinutes * 60 * 1000;
      const remainingMs = totalMs - elapsedMs;

      if (remainingMs > 0) {
        const totalSec = Math.floor(remainingMs / 1000);
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        userCountdownText.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        if (mins < 5) {
          userTimerCircle.className = 'user-timer-circle warning';
          userTimerStatusText.textContent = 'Wrapping Up Soon';
        } else {
          userTimerCircle.className = 'user-timer-circle';
          userTimerStatusText.textContent = 'Time Remaining';
        }
      } else {
        // Expired (F-02 SR-2)
        const overtimeSec = Math.abs(Math.floor(remainingMs / 1000));
        const oMins = Math.floor(overtimeSec / 60);
        const oSecs = overtimeSec % 60;
        userCountdownText.textContent = `-${String(oMins).padStart(2, '0')}:${String(oSecs).padStart(2, '0')}`;
        userTimerCircle.className = 'user-timer-circle expired';
        userTimerStatusText.textContent = 'SESSION EXPIRED';
      }
    }

    tick().catch(error => console.error('Unable to refresh checkout notice:', error));
    timerInterval = setInterval(() => {
      tick().catch(error => console.error('Unable to refresh checkout notice:', error));
    }, 1000);
  }

  btnUserResync.addEventListener('click', async () => {
    if (currentActiveUser) {
      try {
        await window.QFitStore.resyncUser(currentActiveUser.userId);
        alertTimerDesync.style.display = 'none';
      } catch (error) {
        console.error('Unable to resync user timer:', error);
      }
    }
  });

  btnCheckoutSession.addEventListener('click', async () => {
    const targetId = currentActiveUser ? currentActiveUser.id : userProfile.userId;
    try {
      await window.QFitStore.removeUser(targetId, { removedBy: 'self' });
      showScanner();
      showQueueRemovedMessage('You have been removed from the queue.');
    } catch (error) {
      console.error('Unable to check out user:', error);
    }
  });

  // 6. Waitlist UI Logic (Capacity = 20)
  function triggerFiveMinuteWaitlistPopup(isManualDemo = false) {
    const queue = window.QFitStore.getQueue();
    const soonest = queue
      .map(s => {
        const remMs = (s.durationMinutes * 60 * 1000) - (Date.now() - s.joinedAt);
        return { user: s, remMs };
      })
      .filter(item => item.remMs > 0)
      .sort((a, b) => a.remMs - b.remMs)[0];

    let message;
    if (soonest && soonest.remMs <= 5 * 60 * 1000) {
      const minsLeft = Math.max(1, Math.ceil(soonest.remMs / (60 * 1000)));
      message = `${soonest.user.fullName} ahead of you has ${minsLeft} minute${minsLeft === 1 ? '' : 's'} remaining in their session. Please get ready to enter the gym!`;
    } else if (isManualDemo && soonest) {
      message = `Demo Alert: ${soonest.user.fullName} ahead of you has 5 minutes remaining in their session. Please get ready to enter the gym!`;
    } else {
      message = 'The person ahead of you has 5 minutes remaining in their session. Please get ready to enter the gym!';
    }

    showNotificationPopup('5-Minute Entry Reminder', message, '🔔');
  }

  function showWaitlist(entry) {
    if (timerInterval) clearInterval(timerInterval);
    stopCamera();

    viewScanner.style.display = 'none';
    viewTimer.style.display = 'none';
    viewWaitlist.style.display = 'block';

    if (checkNotify5Min && typeof entry.notify5MinBefore === 'boolean') {
      checkNotify5Min.checked = entry.notify5MinBefore;
    }

    const waitlist = window.QFitStore.getWaitlist();
    const pos = waitlist.findIndex(s => s.userId === entry.userId) + 1;
    const peopleAhead = Math.max(0, pos - 1);

    waitlistPosNumber.textContent = `#${pos || 1}`;
    waitlistAheadText.textContent = `${peopleAhead} ${peopleAhead === 1 ? 'person' : 'people'} ahead of you`;

    const queue = window.QFitStore.getQueue();
    let minWait = 10;
    let hasPersonUnder5Min = false;
    if (queue.length > 0) {
      const remainingTimes = queue.map(s => {
        const rem = (s.durationMinutes * 60 * 1000) - (Date.now() - s.joinedAt);
        if (rem > 0 && rem <= 5 * 60 * 1000) {
          hasPersonUnder5Min = true;
        }
        return Math.max(1, Math.round(rem / (60 * 1000)));
      });
      minWait = Math.min(...remainingTimes);
    }
    waitlistEstTime.textContent = `Estimated Wait: ~${minWait * pos} minutes`;

    const cap = window.QFitStore.getCapacityStatus();
    if (!cap.isFull && pos === 1) {
      waitlistReadyBanner.style.display = 'flex';
    } else {
      waitlistReadyBanner.style.display = 'none';
    }

    // Automatically pop up the 5-minute reminder shortly after joining waitlist when enabled
    if (checkNotify5Min && checkNotify5Min.checked && !hasShownWaitlist5MinPopup && (hasPersonUnder5Min || cap.isFull)) {
      hasShownWaitlist5MinPopup = true;
      if (waitlistNotifySimTimeout) clearTimeout(waitlistNotifySimTimeout);
      waitlistNotifySimTimeout = setTimeout(() => {
        if (viewWaitlist.style.display === 'block' && checkNotify5Min.checked) {
          triggerFiveMinuteWaitlistPopup(false);
        }
      }, 1500);
    }
  }

  if (checkNotify5Min) {
    checkNotify5Min.addEventListener('change', async () => {
      if (window.QFitStore.updateWaitlistNotification) {
        try {
          await window.QFitStore.updateWaitlistNotification(userProfile.userId, checkNotify5Min.checked);
        } catch (error) {
          console.error('Unable to update waitlist notification:', error);
        }
      }
      if (!checkNotify5Min.checked) {
        hideNotificationPopup();
      }
    });
  }

  if (btnSimulate5MinNotify) {
    btnSimulate5MinNotify.addEventListener('click', async () => {
      if (checkNotify5Min && !checkNotify5Min.checked) {
        checkNotify5Min.checked = true;
        if (window.QFitStore.updateWaitlistNotification) {
          try {
            await window.QFitStore.updateWaitlistNotification(userProfile.userId, true);
          } catch (error) {
            console.error('Unable to update waitlist notification:', error);
            return;
          }
        }
      }
      triggerFiveMinuteWaitlistPopup(true);
    });
  }

  btnClaimSlot.addEventListener('click', async () => {
    try {
      const promoted = await window.QFitStore.promoteFromWaitlist(userProfile.userId);
      if (promoted) {
        hideNotificationPopup();
        currentActiveUser = promoted;
        showActiveTimer(promoted);
      } else {
        showNotificationPopup('Gym Still at Capacity', 'Please wait until an active user checks out.', '⚠️');
      }
    } catch (error) {
      console.error('Unable to claim gym slot:', error);
    }
  });

  btnLeaveWaitlist.addEventListener('click', async () => {
    hideNotificationPopup();
    try {
      await window.QFitStore.removeWaitlistEntry(userProfile.userId);
      showScanner();
      showQueueRemovedMessage('You have been removed from the waitlist.');
    } catch (error) {
      console.error('Unable to leave waitlist:', error);
    }
  });

  // 7. Store Subscription
  window.QFitStore.subscribe(async (event) => {
    if (event.type === 'USER_ADDED') {
      const added = event.payload || {};
      if (added.userId === userProfile.userId) {
        sessionStorage.setItem('qfit_user_session_active', 'true');
        currentActiveUser = added;
        showActiveTimer(added);
      }
    } else if (event.type === 'USER_REMOVED') {
      const removed = event.payload || {};
      const isCurrentUser =
        removed.userId === userProfile.userId ||
        (currentActiveUser && removed.id === currentActiveUser.id);

      if (isCurrentUser || currentActiveUser) {
        const queue = window.QFitStore.getQueue();
        const stillInQueue = queue.some(s => s.userId === userProfile.userId);
        if (!stillInQueue && currentActiveUser) {
          if (window.QFitStore.consumeCheckoutNotice) {
            await window.QFitStore.consumeCheckoutNotice(userProfile.userId);
          }
          showScanner();
          showQueueRemovedMessage('You have been removed from the queue.');
          return;
        }
      }

      const waitlist = window.QFitStore.getWaitlist();
      const inWait = waitlist.find(s => s.userId === userProfile.userId);
      if (inWait) {
        showWaitlist(inWait);
      }
    } else if (event.type === 'SLOT_AVAILABLE') {
      const waitlist = window.QFitStore.getWaitlist();
      const inWait = waitlist.find(s => s.userId === userProfile.userId);
      if (inWait) {
        showWaitlist(inWait);
      }
    } else if (event.type === 'WAITLIST_PROMOTED') {
      const promoted = event.payload && event.payload.user;
      if (promoted && promoted.userId === userProfile.userId) {
        hideNotificationPopup();
        sessionStorage.setItem('qfit_user_session_active', 'true');
        currentActiveUser = promoted;
        showActiveTimer(promoted);
      }
    } else if (event.type === 'WAITLIST_UPDATED') {
      const waitlist = window.QFitStore.getWaitlist();
      const inWait = waitlist.find(s => s.userId === userProfile.userId);
      if (inWait) {
        showWaitlist(inWait);
      } else if (viewWaitlist.style.display === 'block' && !currentActiveUser) {
        showScanner();
      }
    } else if (event.type === 'DEMO_RESET') {
      evaluateCurrentState();
    }
  });

  // Initial load
  window.QFitStore.ready.then(evaluateCurrentState)
    .catch(error => console.error('Unable to load user queue state:', error));
});
