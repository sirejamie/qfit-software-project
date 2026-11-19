import "./style.css";
import { renderUserTimer } from "./components/userTimer.js";

document.querySelector("#app").innerHTML = `
  <main class="qfit-container">
    <h1>QFit</h1>
    <p>Student Gym Dashboard</p>

    <div id="user-timer"></div>
  </main>
`;

// Start a demonstration timer
renderUserTimer(
  document.querySelector("#user-timer"),
  60
);
