"use client";

import { useState } from "react";
import Link from "next/link";

const TYPICAL_RATE = 0.029;
const SURGE_RATE = 0.025;
const JUNK_FEES_MONTHLY = 30;

function dollars(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-CA");
}

export function SavingsEstimator() {
  const [volume, setVolume] = useState(20000);

  const currentAnnual = volume * TYPICAL_RATE * 12 + JUNK_FEES_MONTHLY * 12;
  const surgeAnnual = volume * SURGE_RATE * 12;
  const savings = Math.max(0, currentAnnual - surgeAnnual);

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-7 text-left shadow-[0_30px_80px_-30px_rgba(15,23,42,0.25)]">
      <div className="flex items-center justify-between">
        <label htmlFor="vol" className="text-sm font-medium text-slate-700">Your monthly card sales</label>
        <span className="text-sm font-semibold tabular-nums text-slate-900">{dollars(volume)}</span>
      </div>
      <input id="vol" type="range" min={2000} max={150000} step={1000} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="mt-3 w-full accent-indigo-600" />
      <div className="mt-1 flex justify-between text-[11px] text-slate-400"><span>$2k</span><span>$150k</span></div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs text-slate-500">Typical card fees / year</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{dollars(currentAnnual)}</div>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-cyan-50 p-4">
          <div className="text-xs text-indigo-700">You could keep / year</div>
          <div className="mt-1 bg-gradient-to-r from-indigo-600 to-cyan-500 bg-clip-text text-2xl font-semibold tabular-nums text-transparent">{dollars(savings)}</div>
        </div>
      </div>

      <Link href="/book" className="mt-6 flex w-full items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_12px_40px_-10px_rgba(79,70,229,0.6)] transition-shadow hover:shadow-[0_16px_50px_-8px_rgba(6,182,212,0.6)]">See my exact savings on a 15-min call</Link>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">Estimate only, based on a typical all-in rate of 2.9% plus roughly $30/mo in monthly and statement fees, versus transparent Surge pricing. Your real rate is quoted on the call.</p>
    </div>
  );
}