"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postBroadcast, setBroadcastActive, deleteBroadcast } from "./actions";

export type Broadcast = {
  id: string;
  title: string;
  body: string;
  active: boolean;
  authorName: string | null;
  createdAt: string;
  acks: { name: string; at: string }[];
};

export function BroadcastsClient({ broadcasts, staffCount }: { broadcasts: Broadcast[]; staffCount: number }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);

  function post() {
    setErr(null);
    start(async () => {
      const res = await postBroadcast({ title, body });
      if ("error" in res) { setErr(res.error); return; }
      setTitle(""); setBody("");
    });
  }
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

  return (
    <div>
      <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 mb-5 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New special starts tonight" className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Announcement</Label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="The message your team will see and acknowledge at the clock." className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm" />
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={post} disabled={pending || !title.trim() || !body.trim()}>{pending ? "Posting…" : "Post announcement"}</Button>
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      </div>

      {broadcasts.length === 0 ? (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-8 text-center text-muted-foreground">
          No announcements yet. Staff acknowledge these by PIN on the clock screen.
        </div>
      ) : (
        <div className="space-y-3">
          {broadcasts.map((b) => (
            <div key={b.id} className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold">{b.title}</span>
                {!b.active && <span className="text-[12px] rounded-full px-2 py-0.5 bg-muted text-muted-foreground">archived</span>}
                <span className="text-[12px] text-muted-foreground ml-auto">{fmt(b.createdAt)}{b.authorName ? " · " + b.authorName : ""}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap mb-2">{b.body}</p>
              <div className="flex items-center gap-3 flex-wrap text-[12px]">
                <button onClick={() => setOpenId(openId === b.id ? null : b.id)} className="underline text-muted-foreground hover:text-foreground">
                  {b.acks.length} of {staffCount} acknowledged
                </button>
                <button onClick={() => start(async () => { await setBroadcastActive(b.id, !b.active); })} disabled={pending} className="underline text-muted-foreground">
                  {b.active ? "archive" : "reactivate"}
                </button>
                <button onClick={() => { if (confirm("Delete this announcement?")) start(async () => { await deleteBroadcast(b.id); }); }} disabled={pending} className="underline text-red-600">delete</button>
              </div>
              {openId === b.id && (
                <div className="mt-2 border-t border-border pt-2">
                  {b.acks.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No one has acknowledged yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {b.acks.map((a, i) => (
                        <span key={i} className="text-[12px] rounded-full px-2 py-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">{a.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
