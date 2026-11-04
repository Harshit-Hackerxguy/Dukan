"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
export function AdminLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="login-page">
      <form
        className="admin-panel record-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (!challengeId) {
              const result = await api<{ challengeId: string }>(
                "auth/request",
                "POST",
                { phone },
              );
              setChallengeId(result.challengeId);
            } else {
              await api("auth/verify", "POST", { challengeId, code });
              router.push("/admin");
              router.refresh();
            }
          } catch (e) {
            setError(e instanceof Error ? e.message : "Sign-in failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className="eyebrow">STORE MANAGER</span>
        <h1>Welcome back.</h1>
        <p>Sign in with your authorized admin mobile number.</p>
        <label>
          Mobile number
          <input
            aria-label="Mobile number"
            type="tel"
            autoComplete="tel"
            required
            value={phone}
            disabled={!!challengeId}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        {challengeId && (
          <label>
            Verification code
            <input
              aria-label="Verification code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="button button-primary" disabled={busy}>
          {busy ? "Please wait…" : challengeId ? "Sign in" : "Send OTP"}
        </button>
        {challengeId && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setChallengeId("");
              setCode("");
            }}
          >
            Start again
          </button>
        )}
        <Link href="/">Back to storefront</Link>
      </form>
    </main>
  );
}
