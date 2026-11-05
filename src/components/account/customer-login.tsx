"use client";
import { useState } from "react";
import { api } from "@/lib/api";
export type CustomerIdentity = { name: string; phone: string };
export function CustomerLogin({
  onSuccess,
}: {
  onSuccess: (customer: CustomerIdentity) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="record-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api("auth/customer", "POST", { name, phone });
          const session = await api<{ customer: CustomerIdentity }>(
            "auth/session",
          );
          onSuccess(session.customer);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not sign in");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Customer sign in</h3>
      <p>
        Enter your name and mobile number to continue. No password or OTP is
        needed.
      </p>
      <label>
        Customer name
        <input
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Mobile number
        <input
          type="tel"
          autoComplete="tel"
          required
          maxLength={30}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-primary" disabled={busy}>
        {busy ? "Signing in…" : "Continue as customer"}
      </button>
    </form>
  );
}
