
import { supabase } from "../supabase.js";

const API_URL = "http://127.0.0.1:8000";

// Retrieve the logged-in student's gym timer
export async function fetchUserTimer() {

  // Get the current Supabase login session
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error("Unable to retrieve login session.");
  }

  // Check if the student is logged in
  if (!session) {
    throw new Error("User is not logged in.");
  }

  // Request timer information from Python
  const response = await fetch(`${API_URL}/api/timer/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`
    }
  });

  // Check whether the request succeeded
  if (!response.ok) {
    throw new Error(
      `Unable to retrieve timer. Status: ${response.status}`
    );
  }

  // Return the timer information
  return await response.json();
}
