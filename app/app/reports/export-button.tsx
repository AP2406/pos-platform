"use client";

// Download the report as a CSV (client-side, from data already computed on the page).
// Read-only — no new server logic, no money-path coupling.
export function ExportButton({ rows, filename }: { rows: (string | number)[][]; filename: string }) {
  function toCsv(): string {
    return rows
      .map((r) =>
        r
          .map((cell) => {
            const s = String(cell ?? "");
            return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
          })
          .join(",")
      )
      .join("\r\n");
  }
  function download() {
    // Prepend a UTF-8 BOM so Excel opens accented names correctly.
    const blob = new Blob(["﻿" + toCsv()], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  return (
    <button
      type="button"
      onClick={download}
      disabled={rows.length <= 1}
      className="shrink-0 text-sm rounded-md border border-border px-2.5 py-1.5 hover:bg-accent disabled:opacity-50"
    >
      Export CSV
    </button>
  );
}
