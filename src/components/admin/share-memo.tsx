"use client";

import { useRef, useState } from "react";

export function ShareMemo({
  memo,
  whatsappShareUrl,
}: {
  memo: { id: string; number: string };
  whatsappShareUrl: string | null;
}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [downloaded, setDownloaded] = useState(false);

  async function share() {
    if (!whatsappShareUrl || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setDownloaded(false);
    // Reserve a tab during the click so async PDF loading avoids popup blocking.
    // It stays blank until the authenticated PDF download has been initiated.
    const chat = window.open("about:blank", "_blank");
    if (chat) chat.opener = null;
    try {
      const response = await fetch(
        `/api/admin/memos/${encodeURIComponent(memo.id)}?download=1`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("application/pdf")
      )
        throw new Error(
          "Could not download the bill. Refresh the page and try again.",
        );
      const blob = await response.blob();
      if (!blob.size) throw new Error("The bill is empty. Please try again.");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${memo.number}.pdf`;
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
        // Keep the blob alive long enough for the browser to consume it.
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      setDownloaded(true);
      if (chat && !chat.closed) chat.location.replace(whatsappShareUrl);
    } catch (e) {
      chat?.close();
      setError(e instanceof Error ? e.message : "Could not share the bill.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="button button-primary"
        disabled={busy || !whatsappShareUrl}
        onClick={share}
      >
        {busy ? "Downloading bill…" : "Share on whatsapp"}
      </button>
      {!whatsappShareUrl && (
        <p>A valid customer phone number is needed to share this bill.</p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {downloaded && whatsappShareUrl && (
        <p role="status">
          Bill download started. Attach the PDF in WhatsApp and send it
          manually.{" "}
          <a href={whatsappShareUrl} target="_blank" rel="noreferrer">
            Open customer’s WhatsApp
          </a>
        </p>
      )}
    </div>
  );
}
