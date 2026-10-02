import clsx from "clsx";
import { CheckCircle2, XCircle } from "lucide-react";

export default function StatusBadge({ status }: { status: "Accept" | "Reject" }) {
  const isAccept = status === "Accept";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
        isAccept ? "bg-clear-50 text-clear-600" : "bg-alert-50 text-alert-600"
      )}
    >
      {isAccept ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {status}
    </span>
  );
}
