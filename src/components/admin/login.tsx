"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
export function AdminLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
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
            await api("auth/login", "POST", { phone, password });
            router.push("/admin");
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Sign-in failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className="eyebrow">STORE MANAGER</span>
        <h1>Welcome back.</h1>
        <p>Sign in with your admin mobile number and password.</p>
        <label>
          Mobile number
          <input
            type="tel"
            autoComplete="username"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="button button-primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <Link href="/">Back to storefront</Link>
      </form>
    </main>
  );
}
