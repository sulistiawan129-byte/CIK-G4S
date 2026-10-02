"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";

export default function ExportButtons({
  onExportExcel,
  onExportPDF,
  disabled,
}: {
  onExportExcel: () => Promise<void>;
  onExportPDF: () => Promise<void>;
  disabled?: boolean;
}) {
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={async () => {
          setLoadingExcel(true);
          try {
            await onExportExcel();
          } finally {
            setLoadingExcel(false);
          }
        }}
        disabled={disabled || loadingExcel}
        className="flex items-center gap-1.5 text-xs font-semibold text-ink-900 border border-steel-100 rounded-lg px-3 py-1.5 hover:bg-steel-50 disabled:opacity-50"
      >
        {loadingExcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        Excel
      </button>
      <button
        onClick={async () => {
          setLoadingPdf(true);
          try {
            await onExportPDF();
          } finally {
            setLoadingPdf(false);
          }
        }}
        disabled={disabled || loadingPdf}
        className="flex items-center gap-1.5 text-xs font-semibold text-ink-900 border border-steel-100 rounded-lg px-3 py-1.5 hover:bg-steel-50 disabled:opacity-50"
      >
        {loadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
        PDF
      </button>
    </div>
  );
}
