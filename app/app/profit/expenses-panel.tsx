"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createExpense, deleteExpense } from "./actions";

type Expense = {
  id: string;
  amount: number;
  category: string;
  subcategory: string | null;
  description: string | null;
  incurred_on: string;
};

const SUGGESTED = [
  "Marketing",
  "Fuel",
  "Vehicle",
  "Insurance",
  "Tolls & parking",
  "Software",
  "Other",
];

export function ExpensesPanel({
  initialExpenses,
  currency,
}: {
  initialExpenses: Expense[];
  currency: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Marketing");
  const [subcategory, setSubcategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  async function add() {
    setErr("");
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0) {
      setErr("Enter a valid amount.");
      return;
    }
    if (!category.trim()) {
      setErr("Pick a category.");
      return;
    }
    setBusy(true);
    const res = await createExpense({
      amount: amt,
      category,
      subcategory: subcategory || undefined,
      description: description || undefined,
      incurred_on: date,
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error || "Couldn't save.");
      return;
    }
    setAmount("");
    setSubcategory("");
    setDescription("");
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    await deleteExpense(id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-muted-foreground">Amount</label>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {SUGGESTED.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-muted-foreground">
            Subcategory (optional)
          </label>
          <input
            type="text"
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
            placeholder="e.g. Google Ads"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm text-muted-foreground">Note (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      <button
        type="button"
        onClick={add}
        disabled={busy}
        className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90"
      >
        Add expense
      </button>

      <div className="border-t border-border pt-4">
        {initialExpenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No expenses yet.</p>
        ) : (
          <div className="space-y-2">
            {initialExpenses.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {e.category}
                    {e.subcategory ? " / " + e.subcategory : ""}
                  </div>
                  <div className="text-muted-foreground truncate">
                    {e.incurred_on}
                    {e.description ? " - " + e.description : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-medium">{fmtMoney(e.amount)}</span>
                  <button
                    type="button"
                    onClick={() => remove(e.id)}
                    disabled={busy}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="w-4 h-4"
                    >
                      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}