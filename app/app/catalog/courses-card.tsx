"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createCourse,
  renameCourse,
  deleteCourse,
  reorderCourses,
  type Course,
} from "../pos/courses-actions";

export function CoursesCard({ initial }: { initial: Course[] }) {
  const [courses, setCourses] = useState<Course[]>(initial);
  const [newName, setNewName] = useState("");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function add() {
    const name = newName.trim();
    if (!name) return;
    setErr(null);
    startTransition(async () => {
      const res = await createCourse(name);
      if ("error" in res) { setErr(res.error); return; }
      setCourses((prev) => [...prev, res.course]);
      setNewName("");
    });
  }

  function rename(id: string, name: string) {
    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    startTransition(async () => { await renameCourse(id, name); });
  }

  function remove(id: string) {
    setErr(null);
    startTransition(async () => {
      const res = await deleteCourse(id);
      if ("error" in res) { setErr(res.error); return; }
      setCourses((prev) => prev.filter((c) => c.id !== id));
    });
  }

  function move(id: string, dir: -1 | 1) {
    setCourses((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= prev.length) return prev;
      const next = prev.slice();
      const [row] = next.splice(idx, 1);
      next.splice(to, 0, row);
      startTransition(async () => { await reorderCourses(next.map((c) => c.id)); });
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Courses group a table&apos;s items so the kitchen fires them in order (drinks first, entrées later). They appear only on the full-service POS.
      </p>
      <div className="space-y-2">
        {courses.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2">
            <div className="flex flex-col">
              <button type="button" onClick={() => move(c.id, -1)} disabled={pending || i === 0} className="h-4 leading-none text-xs text-muted-foreground disabled:opacity-30">▲</button>
              <button type="button" onClick={() => move(c.id, 1)} disabled={pending || i === courses.length - 1} className="h-4 leading-none text-xs text-muted-foreground disabled:opacity-30">▼</button>
            </div>
            <Input value={c.name} onChange={(e) => rename(c.id, e.target.value)} className="h-9 flex-1" />
            <button type="button" onClick={() => remove(c.id)} disabled={pending} className="text-xs text-red-600 underline">Remove</button>
          </div>
        ))}
        {courses.length === 0 && <p className="text-xs text-muted-foreground">No courses yet.</p>}
      </div>
      <div className="flex items-center gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add a course (e.g. Salads)" className="h-9 flex-1" onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <Button onClick={add} disabled={pending || !newName.trim()}>Add</Button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
