"use client";
import Link from "next/link";
import { useState } from "react";
import { ShieldCheck, LoaderCircle } from "lucide-react";
import { Brand } from "@/components/brand";
import { api } from "@/lib/api";

export function AdminLogin({
  developmentPhone,
}: {
  developmentPhone?: string;
}) {
  const [phone, setPhone] = useState(
    developmentPhone?.replace(/^\+91/, "") || "",
  );
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [developmentCode, setDevelopmentCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!challenge) {
        const data = await api<{
          challengeId: string;
          message: string;
          developmentCode?: string;
        }>("/api/auth/request", {
          method: "POST",
          body: JSON.stringify({ phone: `+91${phone}` }),
        });
        setChallenge(data.challengeId);
        setMessage(data.message);
        setDevelopmentCode(data.developmentCode || "");
      } else {
        await api("/api/auth/verify", {
          method: "POST",
          body: JSON.stringify({ challengeId: challenge, code }),
        });
        window.location.reload();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-login">
      <Brand />
      <section className="login-card">
        <ShieldCheck size={34} />
        <span className="eyebrow">STORE MANAGER</span>
        <h1>Welcome back.</h1>
        <p>Sign in with your pre-authorized admin mobile number.</p>
        {developmentPhone && (
          <div className="development-notice">
            <strong>Development sign-in</strong>
            <p>
              This local preview uses a mock OTP for {developmentPhone}. No SMS
              is sent. Mock sign-in is disabled in production.
            </p>
          </div>
        )}
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="admin-phone">Admin mobile number</label>
            <div className="phone-input">
              <span>+91</span>
              <input
                id="admin-phone"
                autoComplete="tel-national"
                type="tel"
                inputMode="numeric"
                required
                pattern="[6-9][0-9]{9}"
                maxLength={10}
                value={phone}
                disabled={!!challenge || busy}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
          {challenge && (
            <>
              <p role="status">{message}</p>
              {developmentCode && (
                <p className="dev-code">
                  Development code: <strong>{developmentCode}</strong>
                </p>
              )}
              <div className="field">
                <label htmlFor="admin-otp">One-time code</label>
                <input
                  id="admin-otp"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button className="button button-primary full-width" disabled={busy}>
            {busy ? (
              <LoaderCircle size={18} className="spin" />
            ) : challenge ? (
              "Verify and sign in"
            ) : (
              "Send sign-in code"
            )}
          </button>
          {challenge && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setChallenge("");
                setCode("");
                setError("");
              }}
            >
              Use another number or request a new code
            </button>
          )}
        </form>
        <Link className="text-button" href="/">
          Back to the catalogue
        </Link>
      </section>
    </main>
  );
}
