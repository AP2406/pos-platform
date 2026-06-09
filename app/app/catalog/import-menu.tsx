"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseMenuUpload, bulkCreateCatalogItems } from "./import-actions";

type ReviewItem = { name: string; price: string; category: string; include: boolean };

const ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,.heic,.docx,.xlsx,.xls,.csv,.txt,image/*,application/pdf";

// ~5MB of base64 (server actions cap the request body; downscaling keeps photos
// well under this, but a large scanned PDF can still be too big).
const MAX_BASE64 = 5000000;

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const isImage = (file.type || "").indexOf("image/") === 0;
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));

    if (!isImage) {
      reader.onload = () => {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        resolve({
          base64: comma >= 0 ? result.slice(comma + 1) : result,
          mimeType: file.type || "",
        });
      };
      reader.readAsDataURL(file);
      return;
    }

    // Downscale images before upload: Gemini reads a menu fine at 1600px, and
    // it keeps the request body small.
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read the image."));
      img.onload = () => {
        const maxDim = 1600;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w >= h) {
            h = Math.round(h * (maxDim / w));
            w = maxDim;
          } else {
            w = Math.round(w * (maxDim / h));
            h = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not process the image."));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        const comma = dataUrl.indexOf(",");
        resolve({ base64: dataUrl.slice(comma + 1), mimeType: "image/jpeg" });
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

export function ImportMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"upload" | "review">("upload");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [fileName, setFileName] = useState("");
  const [pending, startTransition] = useTransition();
  const [doneCount, setDoneCount] = useState<number | null>(null);

  function reset() {
    setStage("upload");
    setBusy(false);
    setErr(null);
    setItems([]);
    setFileName("");
    setDoneCount(null);
  }

  function openModal() {
    reset();
    setOpen(true);
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setErr(null);
    setBusy(true);
    setFileName(file.name);
    try {
      const { base64, mimeType } = await fileToBase64(file);
      if (base64.length > MAX_BASE64) {
        setBusy(false);
        setErr(
          "That file is a bit large to upload. Try a photo of the menu, or split a long PDF into a smaller one."
        );
        return;
      }
      const res = await parseMenuUpload({ name: file.name, mimeType: mimeType, base64: base64 });
      setBusy(false);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setItems(
        res.items.map((i) => ({
          name: i.name,
          price: i.price != null ? String(i.price) : "",
          category: i.category || "",
          include: true,
        }))
      );
      setStage("review");
    } catch (e) {
      setBusy(false);
      setErr(e instanceof Error ? e.message : "Could not read that file.");
    }
  }

  function updateItem(index: number, patch: Partial<ReviewItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  const includedCount = items.filter((i) => i.include && i.name.trim()).length;

  function addToCatalog() {
    setErr(null);
    const payload = items
      .filter((i) => i.include && i.name.trim())
      .map((i) => {
        const p = parseFloat(i.price);
        return {
          name: i.name.trim(),
          price: !isNaN(p) && p >= 0 ? p : 0,
          category: i.category.trim() ? i.category.trim() : null,
        };
      });
    if (payload.length === 0) {
      setErr("Select at least one item to add.");
      return;
    }
    startTransition(async () => {
      const res = await bulkCreateCatalogItems(payload);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setDoneCount(res.created);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-foreground bg-accent px-3 py-1.5 text-sm font-medium hover:bg-accent/80"
      >
        Import menu
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="bg-card border border-border rounded-lg p-5 w-full max-w-2xl text-left max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Import menu</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground underline">
                Close
              </button>
            </div>

            {doneCount !== null ? (
              <div className="space-y-3">
                <p className="text-sm">
                  {"Added " + doneCount + (doneCount === 1 ? " item" : " items") + " to your catalog."}
                </p>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={reset}>Import another</Button>
                  <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Done</Button>
                </div>
              </div>
            ) : stage === "upload" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Upload a menu or product list &mdash; a PDF, photo, Word doc, spreadsheet, or CSV. We&apos;ll pull out the items so you can review them before adding.
                </p>
                <label className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 cursor-pointer hover:bg-accent/40 transition-colors">
                  <span className="text-sm font-medium">{busy ? "Reading..." : "Choose a file"}</span>
                  <span className="text-xs text-muted-foreground">{busy && fileName ? fileName : "PDF, photo, .docx, .xlsx, .csv"}</span>
                  <input
                    type="file"
                    accept={ACCEPT}
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => handleFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                  />
                </label>
                {err && <p className="text-sm text-red-600">{err}</p>}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {"Found " + items.length + (items.length === 1 ? " item" : " items") + " in " + (fileName || "your file") + ". Review and edit, then add the ones you want. Nothing is saved until you add it."}
                </p>

                <div className="rounded-md border border-border divide-y divide-border max-h-[48vh] overflow-y-auto">
                  <div className="grid grid-cols-[24px_1fr_84px_120px] gap-2 px-3 py-2 text-xs text-muted-foreground bg-muted/40 sticky top-0">
                    <span></span>
                    <span>Item</span>
                    <span>Price</span>
                    <span>Category</span>
                  </div>
                  {items.map((it, index) => (
                    <div key={index} className="grid grid-cols-[24px_1fr_84px_120px] gap-2 px-3 py-2 items-center">
                      <input
                        type="checkbox"
                        checked={it.include}
                        onChange={(e) => updateItem(index, { include: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <Input value={it.name} onChange={(e) => updateItem(index, { name: e.target.value })} className="h-8" />
                      <Input value={it.price} onChange={(e) => updateItem(index, { price: e.target.value })} inputMode="decimal" placeholder="0.00" className="h-8 text-right" />
                      <Input value={it.category} onChange={(e) => updateItem(index, { category: e.target.value })} placeholder="(none)" className="h-8" />
                    </div>
                  ))}
                </div>

                {err && <p className="text-sm text-red-600">{err}</p>}

                <div className="flex gap-2">
                  <Button className="flex-1" onClick={addToCatalog} disabled={pending || includedCount === 0}>
                    {pending ? "Adding..." : "Add " + includedCount + (includedCount === 1 ? " item" : " items")}
                  </Button>
                  <Button variant="outline" onClick={reset} disabled={pending}>
                    Start over
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}