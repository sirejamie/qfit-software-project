/**
 * QFIT Student Portal Controller
 * Implements QR Scanner, Live Camera Stream, Demo Skip, Synced Workout Timer, and Waitlist.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Authentication Check
  const authUser = window.QFitAuth ? window.QFitAuth.getCurrentUser() : null;
  const headerName = document.getElementById('student-header-name');
  const scannerMemberName = document.getElementById('scanner-member-name');
  const btnLogout = document.getElementById('btn-student-logout');

  const studentProfile = authUser ? {
    fullName: authUser.fullName,
    studentId: authUser.userIdentifier,
    durationMinutes: 60
  } : {
    fullName: 'Alaena Sang',
    studentId: '620123456',
    durationMinutes: 60
  };

  if (headerName) headerName.textContent = `👤 ${studentProfile.fullName}`;
  if (scannerMemberName) scannerMemberName.textContent = studentProfile.fullName;

  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      stopCamera();
      sessionStorage.removeItem('qfit_student_session_active');
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
  const timerStudentName = document.getElementById('timer-student-name');
  const timerStudentDetails = document.getElementById('timer-student-details');
  const studentCountdownText = document.getElementById('student-countdown-text');
  const studentTimerStatusText = document.getElementById('student-timer-status-text');
  const studentTimerCircle = document.getElementById('student-timer-circle');
  const alertTimerDesync = document.getElementById('alert-timer-desync');
  const btnStudentResync = document.getElementById('btn-student-resync');
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

  let currentActiveStudent = null;
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
    const isSessionActive = sessionStorage.getItem('qfit_student_session_active') === 'true';
    const queue = window.QFitStore.getQueue();
    const waitlist = window.QFitStore.getWaitlist();
    const pendingNotice = window.QFitStore.consumeCheckoutNotice
      ? await window.QFitStore.consumeCheckoutNotice(studentProfile.studentId)
      : null;

    // If student explicitly scanned and joined during this session:
    if (isSessionActive) {
      const inQueue = queue.find(s => s.studentId === studentProfile.studentId);
      if (inQueue) {
        currentActiveStudent = inQueue;
        showActiveTimer(inQueue);
        return;
      }

      const inWait = waitlist.find(s => s.studentId === studentProfile.studentId);
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
    currentActiveStudent = null;
    hasShownWaitlist5MinPopup = false;
    sessionStorage.removeItem('qfit_student_session_active');

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

  // Skip feature for live demo (adds student to queue immediately)
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
      result = await window.QFitStore.addStudent({
        ...studentProfile,
        notify5MinBefore: checkNotify5Min ? checkNotify5Min.checked : true
      });
    } catch (error) {
      scanFailReason.textContent = error.message || 'System failed to add you to the queue. Please scan the QR code again.';
      alertScanFailed.style.display = 'flex';
      return;
    }

    if (result.success) {
      sessionStorage.setItem('qfit_student_session_active', 'true');

      if (result.status === 'active') {
        currentActiveStudent = result.student;
        alertQueueSuccess.style.display = 'flex';
        setTimeout(() => {
          alertQueueSuccess.style.display = 'none';
        }, 3500);
        showActiveTimer(result.student);
      } else if (result.status === 'waitlist') {
        showWaitlist(result.student);
      }
    } else {
      // Sync failed -> Prompt to rescan (F-01 SR-2, AC-2)
      scanFailReason.textContent = result.message || 'System failed to add you to the queue. Please scan the QR code again.';
      alertScanFailed.style.display = 'flex';
    }
  }

  // 5. Active Timer UI (F-02)
  function showActiveTimer(student) {
    if (timerInterval) clearInterval(timerInterval);
    stopCamera();

    viewScanner.style.display = 'none';
    viewWaitlist.style.display = 'none';
    viewTimer.style.display = 'block';

    timerStudentName.textContent = student.fullName;
    timerStudentDetails.textContent = `ID: ${student.studentId}`;

    async function tick() {
      const queue = window.QFitStore.getQueue();
      const updated = queue.find(s => s.id === student.id || s.studentId === student.studentId);

      if (!updated) {
        clearInterval(timerInterval);
        if (window.QFitStore.consumeCheckoutNotice) {
          await window.QFitStore.consumeCheckoutNotice(studentProfile.studentId);
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
        studentCountdownText.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        if (mins < 5) {
          studentTimerCircle.className = 'student-timer-circle warning';
          studentTimerStatusText.textContent = 'Wrapping Up Soon';
        } else {
          studentTimerCircle.className = 'student-timer-circle';
          studentTimerStatusText.textContent = 'Time Remaining';
        }
      } else {
        // Expired (F-02 SR-2)
        const overtimeSec = Math.abs(Math.floor(remainingMs / 1000));
        const oMins = Math.floor(overtimeSec / 60);
        const oSecs = overtimeSec % 60;
        studentCountdownText.textContent = `-${String(oMins).padStart(2, '0')}:${String(oSecs).padStart(2, '0')}`;
        studentTimerCircle.className = 'student-timer-circle expired';
        studentTimerStatusText.textContent = 'SESSION EXPIRED';
      }
    }

    tick().catch(error => console.error('Unable to refresh checkout notice:', error));
    timerInterval = setInterval(() => {
      tick().catch(error => console.error('Unable to refresh checkout notice:', error));
    }, 1000);
  }

  btnStudentResync.addEventListener('click', async () => {
    if (currentActiveStudent) {
      try {
        await window.QFitStore.resyncStudent(currentActiveStudent.studentId);
        alertTimerDesync.style.display = 'none';
      } catch (error) {
        console.error('Unable to resync student timer:', error);
      }
    }
  });

  btnCheckoutSession.addEventListener('click', async () => {
    const targetId = currentActiveStudent ? currentActiveStudent.id : studentProfile.studentId;
    try {
      await window.QFitStore.removeStudent(targetId, { removedBy: 'self' });
      showScanner();
      showQueueRemovedMessage('You have been removed from the queue.');
    } catch (error) {
      console.error('Unable to check out student:', error);
    }
  });

  // 6. Waitlist UI Logic (Capacity = 20)
  function triggerFiveMinuteWaitlistPopup(isManualDemo = false) {
    const queue = window.QFitStore.getQueue();
    const soonest = queue
      .map(s => {
        const remMs = (s.durationMinutes * 60 * 1000) - (Date.now() - s.joinedAt);
        return { student: s, remMs };
      })
      .filter(item => item.remMs > 0)
      .sort((a, b) => a.remMs - b.remMs)[0];

    let message;
    if (soonest && soonest.remMs <= 5 * 60 * 1000) {
      const minsLeft = Math.max(1, Math.ceil(soonest.remMs / (60 * 1000)));
      message = `${soonest.student.fullName} ahead of you has ${minsLeft} minute${minsLeft === 1 ? '' : 's'} remaining in their session. Please get ready to enter the gym!`;
    } else if (isManualDemo && soonest) {
      message = `Demo Alert: ${soonest.student.fullName} ahead of you has 5 minutes remaining in their session. Please get ready to enter the gym!`;
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
    const pos = waitlist.findIndex(s => s.studentId === entry.studentId) + 1;
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
          await window.QFitStore.updateWaitlistNotification(studentProfile.studentId, checkNotify5Min.checked);
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
            await window.QFitStore.updateWaitlistNotification(studentProfile.studentId, true);
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
      const promoted = await window.QFitStore.promoteFromWaitlist(studentProfile.studentId);
      if (promoted) {
        hideNotificationPopup();
        currentActiveStudent = promoted;
        showActiveTimer(promoted);
      } else {
        showNotificationPopup('Gym Still at Capacity', 'Please wait until an active student checks out.', '⚠️');
      }
    } catch (error) {
      console.error('Unable to claim gym slot:', error);
    }
  });

  btnLeaveWaitlist.addEventListener('click', async () => {
    hideNotificationPopup();
    try {
      await window.QFitStore.removeWaitlistEntry(studentProfile.studentId);
      showScanner();
      showQueueRemovedMessage('You have been removed from the waitlist.');
    } catch (error) {
      console.error('Unable to leave waitlist:', error);
    }
  });

  // 7. Store Subscription
  window.QFitStore.subscribe(async (event) => {
    if (event.type === 'STUDENT_ADDED') {
      const added = event.payload || {};
      if (added.studentId === studentProfile.studentId) {
        sessionStorage.setItem('qfit_student_session_active', 'true');
        currentActiveStudent = added;
        showActiveTimer(added);
      }
    } else if (event.type === 'STUDENT_REMOVED') {
      const removed = event.payload || {};
      const isCurrentStudent =
        removed.studentId === studentProfile.studentId ||
        (currentActiveStudent && removed.id === currentActiveStudent.id);

      if (isCurrentStudent || currentActiveStudent) {
        const queue = window.QFitStore.getQueue();
        const stillInQueue = queue.some(s => s.studentId === studentProfile.studentId);
        if (!stillInQueue && currentActiveStudent) {
          if (window.QFitStore.consumeCheckoutNotice) {
            await window.QFitStore.consumeCheckoutNotice(studentProfile.studentId);
          }
          showScanner();
          showQueueRemovedMessage('You have been removed from the queue.');
          return;
        }
      }

      const waitlist = window.QFitStore.getWaitlist();
      const inWait = waitlist.find(s => s.studentId === studentProfile.studentId);
      if (inWait) {
        showWaitlist(inWait);
      }
    } else if (event.type === 'SLOT_AVAILABLE') {
      const waitlist = window.QFitStore.getWaitlist();
      const inWait = waitlist.find(s => s.studentId === studentProfile.studentId);
      if (inWait) {
        showWaitlist(inWait);
      }
    } else if (event.type === 'WAITLIST_PROMOTED') {
      const promoted = event.payload && event.payload.student;
      if (promoted && promoted.studentId === studentProfile.studentId) {
        hideNotificationPopup();
        sessionStorage.setItem('qfit_student_session_active', 'true');
        currentActiveStudent = promoted;
        showActiveTimer(promoted);
      }
    } else if (event.type === 'WAITLIST_UPDATED') {
      const waitlist = window.QFitStore.getWaitlist();
      const inWait = waitlist.find(s => s.studentId === studentProfile.studentId);
      if (inWait) {
        showWaitlist(inWait);
      } else if (viewWaitlist.style.display === 'block' && !currentActiveStudent) {
        showScanner();
      }
    } else if (event.type === 'DEMO_RESET') {
      evaluateCurrentState();
    }
  });

  // Initial load
  window.QFitStore.ready.then(evaluateCurrentState)
    .catch(error => console.error('Unable to load student queue state:', error));
});
