"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateBusinessConfig, saveBusinessConfig } from "./actions";

type GenField = {
  key: string;
  label: string;
  type: string;
  section?: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
};

type GenConfig = {
  vocab: {
    job_singular: string;
    job_plural: string;
    resource_singular: string;
    resource_plural: string;
    asset_singular: string;
    asset_plural: string;
  };
  modules: string[];
  labels?: Record<string, string>;
  fields?: GenField[];
};

export function SetupClient() {
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState<GenConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [genPending, startGen] = useTransition();
  const [savePending, startSave] = useTransition();

  function handleGenerate() {
    setError(null);
    startGen(async () => {
      const res = await generateBusinessConfig(description);
      if ("error" in res) {
        setError(res.error);
        setConfig(null);
      } else {
        setConfig(res.config as GenConfig);
      }
    });
  }

  function handleSave() {
    if (!config) return;
    setError(null);
    startSave(async () => {
      const res = await saveBusinessConfig(config);
      if ("error" in res) {
        setError(res.error);
      } else {
        window.location.href = "/app";
      }
    });
  }

  function moduleLabel(key: string): string {
    if (config && config.labels && config.labels[key]) return config.labels[key];
    if (key === "jobs") return config ? config.vocab.job_plural : "Jobs";
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-card border border-border rounded-lg p-6">
        <label className="text-sm font-medium block mb-2">
          Describe your business
        </label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. I run a hair salon. We book appointments for clients, each with a stylist, a service type, and a duration."
          rows={4}
        />
        <div className="mt-3">
          <Button
            onClick={handleGenerate}
            disabled={genPending || description.trim().length < 10}
          >
            {genPending ? "Generating..." : "Generate setup"}
          </Button>
        </div>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>

      {config && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Here is your setup</h2>
            <p className="text-sm text-muted-foreground mt-1">
              You will book{" "}
              <span className="font-medium text-foreground">
                {config.vocab.job_plural}
              </span>{" "}
              for customers, performed by{" "}
              <span className="font-medium text-foreground">
                {config.vocab.resource_plural}
              </span>
              .
            </p>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-1">Sections</div>
            <div className="flex flex-wrap gap-2">
              {config.modules.map((m) => (
                <span
                  key={m}
                  className="text-sm px-2 py-1 rounded-md border border-border"
                >
                  {moduleLabel(m)}
                </span>
              ))}
            </div>
          </div>

          {config.fields && config.fields.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-2">
                Each {config.vocab.job_singular.toLowerCase()} captures
              </div>
              <div className="flex flex-col gap-1">
                {config.fields.map((f) => (
                  <div key={f.key} className="text-sm flex items-center gap-2">
                    <span className="font-medium">{f.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {f.type}
                      {f.required ? ", required" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={savePending}>
              {savePending ? "Saving..." : "Use this setup"}
            </Button>
            <Button
              variant="outline"
              onClick={handleGenerate}
              disabled={genPending}
            >
              Regenerate
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}