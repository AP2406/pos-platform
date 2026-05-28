"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createBusiness } from "./actions";

const industries = [
  {
    value: "transportation",
    label: "Transportation / Limo",
    description: "Rides, bookings, dispatch",
  },
  {
    value: "restaurant",
    label: "Restaurant / Café / Food Truck",
    description: "Menu, modifiers, takeout",
  },
  {
    value: "retail",
    label: "Retail",
    description: "Products, inventory, SKUs",
  },
  {
    value: "service",
    label: "Service business",
    description: "Appointments, providers",
  },
  {
    value: "mobile_seller",
    label: "Mobile / Event seller",
    description: "Fast checkout, on the go",
  },
] as const;

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState<string>("transportation");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createBusiness({ name, industry });
      if ("error" in result) {
        setError(result.error);
} else {
        window.location.href = "/app";
      }
    });
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Set up your business</CardTitle>
        <CardDescription>Takes about 30 seconds.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Business name</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pearson Limo Toronto"
            />
          </div>

          <div className="space-y-2">
            <Label>What kind of business?</Label>
            <div className="space-y-2">
              {industries.map((i) => (
                <label
                  key={i.value}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition ${
                    industry === i.value
                      ? "border-slate-900 bg-slate-50"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="industry"
                    value={i.value}
                    checked={industry === i.value}
                    onChange={() => setIndustry(i.value)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-sm">{i.label}</div>
                    <div className="text-xs text-slate-500">
                      {i.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Creating..." : "Create business"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}