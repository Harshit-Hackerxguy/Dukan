"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
export function useAdminData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api<T>(path));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path]);
  // Initial synchronization with the authenticated server resource.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);
  return { data, error, loading, reload };
}
export function DataState({
  error,
  loading,
  reload,
}: {
  error: string;
  loading: boolean;
  reload: () => Promise<void>;
}) {
  if (error)
    return (
      <div className="admin-state" role="alert">
        <p>{error}</p>
        <button
          className="button button-secondary"
          onClick={() => void reload()}
        >
          Try again
        </button>
        <a href="/admin">Sign in again</a>
      </div>
    );
  if (loading)
    return (
      <p className="admin-state" role="status">
        Loading store data…
      </p>
    );
  return null;
}
