"use client";

import { useState } from "react";
import Link from "next/link";

const TYPICAL_PCT = 0.029;
const TYPICAL_FIXED = 0.30;
const SURGE_PCT = 0.025;
const SURGE_FIXED = 0.15;

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
    <div className="overflow-hidden rounded-md border border-[#D9E1EA] bg-white text-left shadow-[0_10px_30px_-18px_rgba(10,37,64,0.35)]">
      <div className="bg-[#0A2540] px-6 py-3.5 text-sm font-bold text-white">Estimate your annual savings</div>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <label htmlFor="vol" className="text-sm font-semibold text-[#1A2B3C]">Monthly card sales</label>
          <span className="text-sm font-bold tabular-nums text-[#0A2540]">{dollars(volume)}</span>
        </div>
        <input id="vol" type="range" min={2000} max={150000} step={1000} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="mt-3 w-full accent-[#0A2540]" />
        <div className="mt-1 flex justify-between text-[11px] text-[#7A8CA0]"><span>$2k</span><span>$150k</span></div>

        <div className="mt-5 flex items-center justify-between">
          <label htmlFor="avg" className="text-sm font-semibold text-[#1A2B3C]">Average sale size</label>
          <span className="text-sm font-bold tabular-nums text-[#0A2540]">{dollars(avgSale)}</span>
        </div>
        <input id="avg" type="range" min={5} max={200} step={1} value={avgSale} onChange={(e) => setAvgSale(Number(e.target.value))} className="mt-3 w-full accent-[#0A2540]" />
        <div className="mt-1 flex justify-between text-[11px] text-[#7A8CA0]"><span>$5</span><span>$200</span></div>

        <p className="mt-3 text-xs text-[#7A8CA0]">That is about <span className="font-semibold text-[#42566B]">{txns.toLocaleString("en-CA")}</span> transactions a month.</p>

        <div className="mt-6 overflow-hidden rounded-[4px] border border-[#D9E1EA]">
          <div className="flex items-center justify-between border-b border-[#D9E1EA] px-4 py-3.5 text-[15px]">
            <span className="font-semibold text-[#42566B]">Typical processor <span className="font-normal text-[#7A8CA0]">(2.9% + 30&cent;)</span></span>
            <span className="font-bold tabular-nums text-[#0A2540]">{dollars(typicalAnnual)} / yr</span>
          </div>
          <div className="flex items-center justify-between border-b border-[#D9E1EA] px-4 py-3.5 text-[15px]">
            <span className="font-semibold text-[#42566B]">Surge <span className="font-normal text-[#7A8CA0]">(2.5% + 15&cent;)</span></span>
            <span className="font-bold tabular-nums text-[#0A2540]">{dollars(surgeAnnual)} / yr</span>
          </div>
          <div className="flex items-center justify-between bg-[#EDF7F1] px-4 py-3.5 text-[15px]">
            <span className="font-bold text-[#1E7B4D]">Your annual savings</span>
            <span className="text-lg font-bold tabular-nums text-[#1E7B4D]">{dollars(savings)}</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-[#7A8CA0]">About {dollars(savings / 12)} back in your pocket every month.</p>

        <Link href="/book" className="mt-5 flex w-full items-center justify-center rounded-[4px] bg-[#0A2540] px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#123456]">Show me my exact savings &mdash; book a free call</Link>
        <p className="mt-3 text-[11px] leading-relaxed text-[#7A8CA0]">Estimate only. Compares a common 2.9% + $0.30 per-transaction rate against Surge pricing of 2.5% + $0.15 per transaction. Your exact savings are confirmed on the call.</p>
      </div>
    </div>
  );
}
