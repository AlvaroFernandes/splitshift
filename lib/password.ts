// Sets the signed-in user's password via /api/password. Returns an error
// message, or null on success.
export async function updatePassword(password: string): Promise<string | null> {
  try {
    const res = await fetch("/api/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const json = await res.json().catch(() => ({})) as { error?: string };
    return res.ok ? null : json.error ?? "Could not update password.";
  } catch {
    return "Could not update password. Check your connection and try again.";
  }
}
