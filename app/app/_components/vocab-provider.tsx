"use client";

import { createContext, useContext, ReactNode } from "react";
import { Vocab, DEFAULT_VOCAB } from "@/lib/modules/registry";
import { FieldDef } from "@/lib/modules/presets";

type AppConfig = { vocab: Vocab; fields: FieldDef[] };

const ConfigContext = createContext<AppConfig>({ vocab: DEFAULT_VOCAB, fields: [] });

export function VocabProvider({
  vocab,
  fields,
  children,
}: {
  vocab: Vocab;
  fields: FieldDef[];
  children: ReactNode;
}) {
  return (
    <ConfigContext.Provider value={{ vocab, fields }}>{children}</ConfigContext.Provider>
  );
}

export function useVocab(): Vocab {
  return useContext(ConfigContext).vocab;
}

export function useFields(): FieldDef[] {
  return useContext(ConfigContext).fields;
}