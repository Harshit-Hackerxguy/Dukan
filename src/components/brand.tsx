"use client";
import { useStore } from "@/components/store-provider";
import Link from "next/link";
import { Wheat } from "lucide-react";

export function Brand({ admin = false }: { admin?: boolean }) {
  const { storeInfo } = useStore();
  return (
    <Link
      href={admin ? "/admin" : "/"}
      className="brand"
      aria-label={`${storeInfo.name} ${admin ? "admin dashboard" : "home"}`}
    >
      <span className="brand-mark">
        <Wheat size={25} strokeWidth={1.7} />
      </span>
      <span className="brand-type">
        {storeInfo.name}
        <b>.</b>
        <small>{admin ? "STORE MANAGER" : "WHOLESALE, MADE SIMPLE"}</small>
      </span>
    </Link>
  );
}
