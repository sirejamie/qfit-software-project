const API = "http://localhost:8000";

export function setupWaitingTime(element, userId) {
  const render = (data) => {
    if (!data) {
      element.innerHTML = "<p>Loading...</p>";
    } else if (data.qr_active) {
      element.innerHTML = "<p>QR code active. You can enter the gym.</p>";
    } else {
      element.innerHTML = `
        <h2>Gym is at capacity</h2>
        <p>People in queue: ${data.queue_length}</p>
        <p>Your position: ${data.position}</p>
        <p>Estimated wait: ~${data.estimated_wait_minutes} min</p>
      `;
    }
  };

  const load = () =>
    fetch(`${API}/queue/wait-time?user_id=${userId}`)
      .then((r) => r.json())
      .then(render)
      .catch(() => {
        element.innerHTML = "<p>Could not reach the server.</p>";
      });

  render(null);
  load();
  setInterval(load, 10000); // refresh every 10 seconds
}