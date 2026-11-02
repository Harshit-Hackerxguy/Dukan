import Link from "next/link";
import { ArrowLeft, Sprout } from "lucide-react";
import { Brand } from "@/components/brand";
export default function NotFound() {
  return (
    <main className="not-found">
      <Brand />
      <div>
        <Sprout size={48} strokeWidth={1.3} />
        <span className="eyebrow">A LITTLE OFF THE BEATEN PATH</span>
        <h1>This shelf is empty.</h1>
        <p>
          We couldn’t find that page. There are plenty of good things back at
          the store.
        </p>
        <Link className="button button-primary" href="/">
          <ArrowLeft size={17} /> Back to the store
        </Link>
      </div>
    </main>
  );
}
