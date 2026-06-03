"use client";

import { useState } from "react";
import Link from "next/link";

const TYPICAL_PCT = 0.029;
const TYPICAL_FIXED = 0.30;
const SURGE_PCT = 0.025;
const SURGE_FIXED = 0.18;

function dollars(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-CA");
}

export function SavingsEstimator() {
  const [volume, setVolume] = useState(20000);
  const [avgSale, setAvgSale] = useState(25);

  const txns = Math.max(1, Math.round(volume / avgSale));
  const typicalAnnual = (volume * TYPICAL_PCT + txns * TYPICAL_FIXED) * 12;
  const surgeAnnual = (volume * SURGE_PCT + txns * SURGE_FIXED) * 12;
  const savings = Math.max(0, typicalAnnual - surgeAnnual);

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-7 text-left shadow-[0_30px_80px_-30px_rgba(15,23,42,0.25)]">
      <div className="flex items-center justify-between">
        <label htmlFor="vol" className="text-sm font-medium text-slate-700">Monthly card sales</label>
        <span className="text-sm font-semibold tabular-nums text-slate-900">{dollars(volume)}</span>
      </div>
      <input id="vol" type="range" min={2000} max={150000} step={1000} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="mt-3 w-full accent-blue-600" />
      <div className="mt-1 flex justify-between text-[11px] text-slate-400"><span>$2k</span><span>$150k</span></div>

      <div className="mt-5 flex items-center justify-between">
        <label htmlFor="avg" className="text-sm font-medium text-slate-700">Average sale size</label>
        <span className="text-sm font-semibold tabular-nums text-slate-900">{dollars(avgSale)}</span>
      </div>
      <input id="avg" type="range" min={5} max={200} step={1} value={avgSale} onChange={(e) => setAvgSale(Number(e.target.value))} className="mt-3 w-full accent-blue-600" />
      <div className="mt-1 flex justify-between text-[11px] text-slate-400"><span>$5</span><span>$200</span></div>

      <p className="mt-3 text-xs text-slate-500">That is about <span className="font-semibold text-slate-700">{txns.toLocaleString("en-CA")}</span> transactions a month.</p>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-medium text-slate-500">What you pay now</div>
          <div className="text-[11px] text-slate-400">2.9% + $0.30 / sale</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{dollars(typicalAnnual)}</div>
          <div className="text-[11px] text-slate-400">in fees / year</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-4">
          <div className="text-xs font-medium text-blue-700">With Surge</div>
          <div className="text-[11px] text-blue-500">2.5% + $0.18 / sale</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{dollars(surgeAnnual)}</div>
          <div className="text-[11px] text-slate-400">in fees / year</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-cyan-50 px-4 py-4">
        <div>
          <div className="text-sm font-semibold text-emerald-800">Your savings with Surge</div>
          <div className="text-[11px] text-emerald-700">about {dollars(savings / 12)} back in your pocket every month</div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums text-emerald-600">{dollars(savings)}</div>
          <div className="text-[11px] font-medium text-emerald-700">saved / year</div>
        </div>
      </div>

      <Link href="/book" className="mt-6 flex w-full items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_12px_40px_-10px_rgba(37,99,235,0.6)] transition-shadow hover:shadow-[0_16px_50px_-8px_rgba(6,182,212,0.6)]">Show me my exact savings &mdash; book a free call</Link>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">Estimate only. Compares a common 2.9% + $0.30 per-transaction rate against Surge pricing of 2.5% + $0.18 per transaction. Your exact savings are confirmed on the call.</p>
    </div>
  );
}