"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addTemplate, deleteTemplate, completeTask, uncompleteTask } from "./actions";

export type Task = {
  id: string;
  label: string;
  assignee: string | null;
  done: boolean;
  byName: string | null;
  at: string | null;
};
const SEGMENTS = [
  { key: "open", label: "Opening" },
  { key: "close", label: "Closing" },
  { key: "changeover", label: "Shift changeover" },
];

export function ChecklistsClient({ tasksBySegment, canManage }: { tasksBySegment: Record<string, Task[]>; canManage: boolean }) {
  const [signerPin, setSignerPin] = useState("");
  const [pending, start] = useTransition();
  const [editSeg, setEditSeg] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newAssignee, setNewAssignee] = useState("");

  function toggle(t: Task) {
    start(async () => {
      if (t.done) await uncompleteTask(t.id);
      else await completeTask(t.id, signerPin || undefined);
    });
  }
  function add(segment: string) {
    if (!newLabel.trim()) return;
    start(async () => {
      await addTemplate({ label: newLabel, segment, assignee: newAssignee });
      setNewLabel(""); setNewAssignee("");
    });
  }
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));

  return (
    <div>
      <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-3 mb-5 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Signing off as:</span>
        <Input value={signerPin} onChange={(e) => setSignerPin(e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode="numeric" placeholder="your PIN (optional)" className="h-8 w-40" />
        <span className="text-[12px] text-muted-foreground">Enter your PIN once, then check off your tasks to sign them.</span>
      </div>

      <div className="space-y-5">
        {SEGMENTS.map((seg) => {
          const tasks = tasksBySegment[seg.key] ?? [];
          const doneN = tasks.filter((t) => t.done).length;
          return (
            <div key={seg.key}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold">{seg.label} <span className="text-xs font-normal text-muted-foreground">{tasks.length > 0 ? `${doneN}/${tasks.length}` : ""}</span></h2>
                {canManage && (
                  <button onClick={() => setEditSeg(editSeg === seg.key ? null : seg.key)} className="text-[12px] underline text-muted-foreground hover:text-foreground">
                    {editSeg === seg.key ? "done" : "edit"}
                  </button>
                )}
              </div>
              <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl divide-y divide-border overflow-hidden">
                {tasks.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No tasks yet{canManage ? " — add some with “edit”." : "."}</div>
                ) : tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 p-3">
                    <input type="checkbox" checked={t.done} onChange={() => toggle(t)} disabled={pending} className="h-5 w-5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className={"text-sm " + (t.done ? "line-through text-muted-foreground" : "")}>{t.label}</div>
                      {(t.assignee || (t.done && (t.byName || t.at))) && (
                        <div className="text-[12px] text-muted-foreground">
                          {t.assignee && <span>{t.assignee}</span>}
                          {t.done && (t.byName || t.at) && <span>{t.assignee ? " · " : ""}✓ {t.byName ?? ""}{t.at ? " " + fmt(t.at) : ""}</span>}
                        </div>
                      )}
                    </div>
                    {canManage && editSeg === seg.key && (
                      <button onClick={() => { if (confirm("Remove this task?")) start(async () => { await deleteTemplate(t.id); }); }} disabled={pending} className="text-[12px] text-red-600 underline shrink-0">remove</button>
                    )}
                  </div>
                ))}
                {canManage && editSeg === seg.key && (
                  <div className="p-3 flex flex-wrap items-end gap-2 bg-muted/30">
                    <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="New task" className="h-8 flex-1 min-w-[160px]" />
                    <Input value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)} placeholder="Who (optional)" className="h-8 w-36" />
                    <Button className="h-8" onClick={() => add(seg.key)} disabled={pending || !newLabel.trim()}>Add</Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
