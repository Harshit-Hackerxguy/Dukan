import Link from "next/link";
import { Wheat } from "lucide-react";
import { storeConfig } from "@/lib/store-config";

export function Brand({ admin = false }: { admin?: boolean }) {
  return (
    <Link
      href={admin ? "/admin" : "/"}
      className="brand"
      aria-label={`${storeConfig.name} ${admin ? "admin dashboard" : "home"}`}
    >
      <span className="brand-mark">
        <Wheat size={25} strokeWidth={1.7} />
      </span>
      <span className="brand-type">
        {storeConfig.name}
        <b>.</b>
        <small>{admin ? "STORE MANAGER" : "WHOLESALE, MADE SIMPLE"}</small>
      </span>
    </Link>
  );
}
