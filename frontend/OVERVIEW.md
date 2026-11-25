# QFIT - Gym Queue & Timer Management System
**UWI Mona Gym &bull; Group 4**  
*Alaena Sang (F-01 Owner), Tajae Jacobs, Jamie Gattie (F-02 Owner), Alwyn Brown, Taj Robinson (F-03 Owner)*

---

## 🏋️‍♂️ System Architecture & Flow

### 1. Welcome Page (`index.html`)
When users open the web application, they arrive at the **Welcome Page**:
- Overview of the UWI Mona Gym (Students' Union Complex).
- Real-time facility occupancy gauge displaying live attendance.
- High-visibility primary action button: **"Proceed to Login Portal &rarr;"** (directs to `login.html`).
- Link to Entrance Kiosk display.

### 2. Login Portal (`login.html`)
Modeled after modern split-screen design:
- **Left Panel**: Athletic Red & Matte Charcoal graphic branding.
- **Right Panel**: Login form with User ID, Password, and "Remember me" checkbox.
- **Verification Logic**: Checks credentials and automatically routes users to their respective portal:
  - **Staff ID** &rarr; Staff Management Dashboard (`staff.html`)
  - **Student ID** &rarr; Student Workout Portal (`student.html`)
- **Error Feedback**: Styled with a red warning alert (`⚠️ Incorrect username or password. Try again.`) and red input highlights.
- **Forgot Password**: Password reset modal to update password.
- **Signup**: Account creation modal to register as a student or staff member.

### 3. Student Portal (`student.html`)
- **Step 1: QR Code Scanner Screen**:
  - Live camera scanner simulation with viewport frame.
  - **Demo Skip Feature**: Prominent button `⚡ Skip QR Scanner & Join Queue (Demo Feature)` to immediately admit the student during presentations.
  - **Backend Sync Verification**: Upon scanning, shows confirmation of addition to queue. If sync encounters an error, displays a prompt to scan the QR code again.
- **Step 2: Active Workout Timer UI**:
  - Displays the student's verified Name, ID, Faculty, and a live countdown timer synchronized with the staff dashboard.
  - Visual status alerts when time is wrapping up (< 5 mins) and when time expires.
  - One-click checkout button to finish workout and release gym capacity.
- **Step 3: Waitlist Flow (Capacity = 20)**:
  - When the gym is at maximum capacity (20/20), students who scan are added to the **Waitlist**.
  - Shows their waitlist position (`#1 on Waitlist`), how many people are ahead of them, and estimated wait time.
  - Option to toggle **"Receive notification 5 mins before entry"**.
  - As soon as an active student checks out and capacity frees up, an immediate prompt appears: **"A gym slot has opened up! [Enter Gym Queue Now &rarr;]"**. Clicking it transfers the student into the active queue and starts their workout timer.

### 4. Staff Portal (`staff.html`)
Modeled after the modern sidebar dashboard design:
- **Sidebar**: Staff profile avatar, name (`Coach J. Miller`), and quick links.
- **Two Main Tabs**:
  - **Active Gym Sessions** (Badge shows live count, e.g. `17 / 20`)
  - **Waitlist** (Badge shows count of waiting students)
- **Search, Filter & Sort Toolbar**:
  - Real-time search across student name, student ID, or faculty.
  - Filter by expiration range (`All Sessions`, `Expired Only`, `< 10 Mins`, `< 15 Mins`, `< 30 Mins`).
  - Sort by remaining time (lowest first or highest first) or arrival order.
- **Active Sessions Table**:
  - Shows Queue #, Student Details (Avatar, Name, ID), Faculty, Entry Time, Live Countdown Timer, Timer Sync Status, and Actions.
  - **Expired Highlighting**: When a student's timer reaches `00:00`, their row is **highlighted in red at the top of the queue** with a pulsing alert and `⏰ EXPIRED` badge.
  - **Timer Resync Action**: Out-of-sync timers show a warning (`⚠️ Out of Sync`) and a **"🔄 Resync"** button allowing staff to resynchronize the timer with one click.
  - **Manual Checkout**: "Check Out" button removes the student and immediately notifies the waitlist.
- **Waitlist Table**:
  - Shows waiting students, arrival times, 5-minute notification settings, and a manual **"Admit to Gym"** button.

### 5. Entrance Kiosk (`kiosk.html`)
- Dedicated entrance display showing the dynamic SVG QR code for students to scan upon physical arrival.
- Displays live facility occupancy and automatically displays a lockout overlay when capacity (20) is reached.

---

## ⚡ Pre-Configured Test Data for Demonstration

### Login Credentials

| Role | User ID / Name | Password | Initial State / Action |
| :--- | :--- | :--- | :--- |
| **Gym Staff** | `STAFF101` *(Coach J. Miller)* | `staff123` | Opens Staff Dashboard (`staff.html`) |
| **Student** | `620123456` *(Alaena Sang)* | `student123` | Opens Student Scanner (`student.html`) |
| **Student 2** | `620198765` *(Tajae Jacobs)* | `student123` | Secondary student account |

### 17 Preloaded Initial Students in Active Queue (Capacity = 20)
The system initializes with **17 active students** already in the gym, providing 3 remaining spots:
1. **Marcus Sterling**: Session already **expired by 3 minutes** &rarr; demonstrates the **red highlight at the top of the queue** (`⏰ EXPIRED (-03:15)`).
2. **Kevon Campbell**: Session has **3 minutes remaining** &rarr; demonstrates the **yellow wrap-up warning** (`< 5 mins`).
3. **Brittany Watson**: Timer is flagged as **out of sync** &rarr; demonstrates the **"⚠️ Out of Sync"** warning badge and the **"🔄 Resync"** action button.
4. **Students 4 through 17**: Staggered workout timers (from 7 to 48 minutes remaining).
5. **Testing Queue Entry**: When you sign in as student (`Alaena Sang`) and tap *"Skip QR Scanner & Join Queue"*, you are added as student **#18 of 20**!
6. **Testing Waitlist**: Adding 3 more students fills capacity to 20/20, after which subsequent students are placed on the **Waitlist** with queue position and 5-minute notification tracking!

---

## 🚀 How to Run

1. Open folder: `C:\Users\alaen\.gemini\antigravity\scratch\qfit-frontend`
2. Open `index.html` in any web browser.
3. Open `staff.html` and `student.html` in side-by-side windows for real-time live synchronization!
