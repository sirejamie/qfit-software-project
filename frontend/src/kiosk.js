/**
 * QFIT Entrance Kiosk Controller
 * Renders live QR code and reacts to gym capacity & deactivation states (F-01, F-03)
 */

document.addEventListener('DOMContentLoaded', () => {
  const qrSvgWrapper = document.getElementById('qr-svg-wrapper');
  const qrContainer = document.getElementById('qr-container');
  const qrOverlayLocked = document.getElementById('qr-overlay-locked');
  const kioskStatusBadge = document.getElementById('kiosk-status-badge');
  const kioskCapacityText = document.getElementById('kiosk-capacity-text');
  const kioskCapacityBar = document.getElementById('kiosk-capacity-bar');
  const kioskFullAlert = document.getElementById('kiosk-full-alert');

  // Generate target check-in URL
  const userCheckinUrl = window.location.origin + window.location.pathname.replace('kiosk.html', 'user.html');

  // Render SVG QR Code
  qrSvgWrapper.innerHTML = window.QFitQR.generateSVG(userCheckinUrl, 220);

  function updateKioskView() {
    const capacity = window.QFitStore.getCapacityStatus();
    const { currentCount, maxCapacity, isFull, isQrActive, manualDeactivated } = capacity;

    kioskCapacityText.textContent = `${currentCount} / ${maxCapacity} Users`;
    const pct = Math.min(100, Math.round((currentCount / maxCapacity) * 100));
    kioskCapacityBar.style.width = `${pct}%`;

    if (pct >= 100) {
      kioskCapacityBar.className = 'capacity-bar-fill danger';
    } else if (pct >= 70) {
      kioskCapacityBar.className = 'capacity-bar-fill warning';
    } else {
      kioskCapacityBar.className = 'capacity-bar-fill';
    }

    if (isQrActive) {
      // ACTIVE (F-03 TS-4: QR code remains active when below max capacity)
      qrContainer.classList.remove('deactivated');
      qrOverlayLocked.style.display = 'none';
      kioskFullAlert.style.display = 'none'; // F-03 TS-6
      kioskStatusBadge.className = 'badge badge-success';
      kioskStatusBadge.textContent = '✅ QR Code Active & Ready';
    } else {
      // DEACTIVATED (F-03 SR-2, AC-2, TS-3)
      qrContainer.classList.add('deactivated');
      qrOverlayLocked.style.display = 'block';

      if (isFull) {
        kioskStatusBadge.className = 'badge badge-danger';
        kioskStatusBadge.textContent = '🚫 Gym Full - QR Code Deactivated';
        kioskFullAlert.style.display = 'flex'; // F-03 SR-3, AC-3, TS-5
      } else if (manualDeactivated) {
        kioskStatusBadge.className = 'badge badge-warning';
        kioskStatusBadge.textContent = '⏸️ Entry Temporarily Paused by Staff';
        kioskFullAlert.style.display = 'none';
      }
    }
  }

  // Subscribe to real-time events
  window.QFitStore.subscribe(() => {
    updateKioskView();
  });

  // Initial load
  window.QFitStore.ready.then(updateKioskView)
    .catch(error => console.error('Unable to load gym capacity:', error));
});
