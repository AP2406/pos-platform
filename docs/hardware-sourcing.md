# Surge Hardware Sourcing Brief

**Prepared:** 2026-09-10
**Scope:** Hardware Surge would resell/bundle with its restaurant POS + merchant services offering, GTA / Canada-wide.
**Method:** Desk research only. No supplier was contacted, no quotes requested, no accounts created, nothing purchased. Every price below is a published list price from a public page, with the URL inline.

> **Read this first — research integrity note.** Alibaba.com was the requested primary source and it could **not** be searched. Every entry point (`/trade/search`, `/showroom/*`, product-detail URLs) either served a slider CAPTCHA or returned "No results". Solving CAPTCHAs is out of scope, so Alibaba listings are **absent from this brief**. Where FOB-China pricing appears below it comes from **Made-in-China.com**, which is the same market, the same factories, and the same FOB/MOQ pricing convention — but it is a substitute, not the source you asked for. Treat FOB numbers as indicative of the market, not as quotes. See [Appendix A](#appendix-a--what-i-could-not-verify).

---

## 1. Headline recommendation

**Sell the POS stack. Do not put a food-running robot in the Surge bundle in this cycle.**

Three things drove that:

1. **There is no margin in it for Surge.** The Canadian channel price is already at parity with the US integrator price. RoboTools Canada lists a **Pudu BellaBot Pro at CAD 21,000** ([robotools.ca](https://robotools.ca/product-category/delivery-robots/)); RobotLAB in the US lists the same class of machine at **USD 16,000** ([robotlab.com](https://www.robotlab.com/store/bellabot-pro/)) — about CAD 22,100 at 1.3817 ([TradingEconomics, 2026-09-10](https://tradingeconomics.com/canada/currency)). The distributor is not marking it up much, which means there is not much room underneath them for Surge either.
2. **The cheap version is the dangerous version.** Direct-from-China white-label serving robots run **USD 1,800–6,900 FOB, MOQ 1** ([Made-in-China supplier list](https://www.made-in-china.com/manufacturers-suppliers/restaurant-delivery-robot.html)). That is a 4–8x spread against BellaBot. The spread is not stupidity — it is the service contract, the certification, and the spare-parts depot. More on this in §3.
3. **It is off-strategy.** Surge's pitch is "a local person on the phone." A robot is the single highest-touch, highest-blame object you can put in a restaurant. The first time one drives into a high-chair on a Friday night, the customer calls Surge — and Surge's answer is a 6-week parts shipment from Shenzhen. That risk buys you nothing on the merchant-services side, which is where the recurring revenue actually is.

**What I would do instead:** hold one BellaBot-class unit as a **referral/introduction relationship** with a Canadian Pudu distributor (S.P.A.R.C. Technologies for Ontario, or Nova Dynamic nationally — [pudurobotics.com news](https://www.pudurobotics.com/about/news/677bc0b7c3c5d30043096487)). Surge introduces, the distributor sells, installs, and owns the SLA. Surge keeps a referral fee and keeps its phone line clean. Revisit owning the category once Surge has >150 sites and a field-service tech on payroll.

**This is a business judgement, not a research finding.** The research supports "the economics are thin and the service exposure is real." Whether that is disqualifying depends on how Surge weights land-grab/differentiation against support load — which is your call, not mine.

### The rest of the stack, in one line each

| Category | Call | Why |
|---|---|---|
| Receipt printers | **Bundle. Distributor, not Alibaba.** | Epson TM-series. Native ESC/POS, cUL/CSA-marked, next-day Canadian stock. |
| Kitchen printers | **Bundle.** | Epson TM-U220II impact + OT-BZ20 buzzer, or Star SP742ME + BU01-24-A buzzer. |
| Cash drawers | **Bundle. This is the one worth importing.** | Dumb, heavy, low-warranty-risk, RJ11-driven. 10x margin available. |
| Barcode scanners | **Drop-ship.** | Low attach rate in restaurants. Don't hold stock. |
| iPad stands / enclosures | **Bundle the counter stand, drop-ship the floor stand.** | Counter stand is a per-site consumable. Floor stands are bulky and rarely ordered. |
| Customer-facing displays | **Skip for now.** | Either use a second iPad you're already selling, or leave it to the payment terminal's own screen. |
| Label printers | **Drop-ship.** | Real demand for prep/date labelling, but it's a Brother/DYMO commodity — no reason to warehouse it. |
| KDS screens / bump bars | **Bundle the bump bar, drop-ship the screen.** | Bump bar is small and specific. Screens are generic monitors. |
| **Robots** | **Refer, don't resell.** | See §3. |

---

## 2. Landed cost — why the Alibaba/Made-in-China price is not the price

An FOB price is the price of the box sitting on a dock in Shenzhen. Here is what has to happen before it is a unit in a Toronto warehouse.

**Inputs used (all cited, all subject to change):**

| Input | Value | Source |
|---|---|---|
| USD → CAD | 1.3817 (2026-09-10) | [TradingEconomics](https://tradingeconomics.com/canada/currency) |
| LCL ocean, China → Canada | USD 65–160 / CBM, port-to-port only | [Suaid Global](https://suaidglobal.com/insights/lcl-cost-per-cbm/), [FreightAmigo](https://www.freightamigo.com/en/blog/logistics/lcl-shipping-freight-rates-for-containers-complete-2026-guide/) |
| Customs brokerage | ~USD 50–100 per shipment (entry prep) | [G-City Services](https://www.gcityservices.ca/knowledge-centre/customs-brokerage-clearance/customs-brokerage-fees-canada) |
| Duty (MFN, China) | Electronics generally **0–6%** — **must be confirmed per HS code** | [EpicSourcing](https://www.epicsourcing.ca/post/canada-china-import-duties-2026-guide) |
| GST | 5% on duty-paid value (recoverable ITC) | — |

**Worked example — 100 cash drawers, the best import candidate on the list:**

| Line | Amount |
|---|---|
| FOB unit (Yoko YK-335A, RJ11, 12V) | USD 13.50 |
| × 100 units | USD 1,350 |
| Ocean LCL (~0.035 CBM/unit ≈ 3.5 CBM @ USD 120) | USD 420 |
| Terminal handling + drayage + inland to GTA (est.) | USD 350 |
| Brokerage + entry | USD 100 |
| Duty @ 4% (placeholder — **verify**) | USD 54 |
| **Landed, pre-tax** | **USD 2,274 → CAD ~3,142** |
| **Per unit landed** | **~CAD 31** |
| Canadian distributor comparable (Star CD4-1416) | [CAD 214.99](https://loyaltysensepos.com/collections/cash-drawers) |

That is a genuinely large gap, and it is why cash drawers are the one category where importing is obviously worth it. Note what the model does **not** include: certification (§5), Quebec-compliant French inserts, warranty reserve, dead-on-arrival replacement stock, storage, and the working capital tied up in 100 units.

**The same model applied to a robot goes the other way.** A USD 4,300 FOB robot is roughly 1.1 CBM and ~40–55 kg, so freight and handling are material rather than trivial, and — critically — the FOB price does not include mapping, commissioning, staff training, a charging dock spare, or anyone in Canada who can open the chassis. The delta between USD 4,300 landed and CAD 13,440 for a PuduBot 2 from a Canadian dealer is not margin. It is the service business you would have to build.

**Rule of thumb from the above:** import where the item is heavy, dumb, and unlikely to need warranty service. Buy locally where the item is light, smart, and will generate support calls. Cash drawers pass. Robots fail. Printers fail on certification grounds (§5).

---

## 3. Robots — the sceptical read

### The machines are real and the specs are good

| Model | Payload / trays | Battery | Navigation | Floor markers? | Price |
|---|---|---|---|---|---|
| **Pudu BellaBot** | 40 kg max, 10 kg/tray, 4 trays | 13 h unloaded, 4.5 h charge | Dual SLAM — LiDAR **and** visual; 3× RGBD + LiDAR, 0.5 s stop response | **Optional.** Marker positioning up to 8 m ceiling; **laser positioning is code-free with no height limit** | USD 14,500 ([RobotLAB](https://www.robotlab.com/store/bellabot/)) |
| **Pudu BellaBot Pro** | as above | as above | as above + ad screen | as above | USD 16,000 ([RobotLAB](https://www.robotlab.com/store/bellabot-pro/)) / **CAD 21,000** ([RoboTools](https://robotools.ca/product-category/delivery-robots/)) |
| **Pudu PuduBot 2** | 40 kg, 3 trays std / 7 max | 12 h unloaded, 15 h loaded, 4 h charge | VSLAM+ **marker-less**, dual LiDAR, ceilings to 30 m, maps to 40,000 m² | **No** — marker-less, 75% faster deploy | **CAD 13,440** ([RoboTools](https://robotools.ca/product-category/delivery-robots/)) |
| **Pudu KettyBot** | 40 kg | 7–12 h | LiDAR + CV | — | USD 14,000 ([RobotLAB](https://www.robotlab.com/store/bellabot/)) |
| **KEENON DinerBot T8** | 20 kg, 3 trays | 15 h | SLAM: encoders + IMU + LiDAR + vision + UWB; 3× stereo vision, detects <5 cm obstacles | Laser mapping version available | ~USD 7,000, range USD 5,500–11,000 ([RobotSourced](https://robotsourced.com/robots/service/keenon-t8/)) |
| **KEENON DinerBot T10** | 40 kg | — | — | — | **CAD 32,499** ([RoboTools](https://robotools.ca/product-category/delivery-robots/)) |
| **Bear Robotics Servi** | 66 lb total, 22 lb/tray | 10–12 h, 4 h charge | — | — | USD 9,990 ([RobotLAB](https://www.robotlab.com/store/bellabot/)) |

Two operational details worth knowing because sales reps get them wrong:

- **Aisle clearance is the real constraint, not payload.** PuduBot 2 needs **80 cm path width** ([Pudu](https://www.pudurobotics.com/en/products/pudubot2)). The DinerBot T8 fits **55 cm** ([RobotSourced](https://robotsourced.com/robots/service/keenon-t8/)). A lot of GTA restaurants — especially the dense Chinese, Korean, and Vietnamese rooms that are the obvious first adopters — do not have 80 cm between tables at service time with chairs pushed out. Measure before you quote.
- **Climbing angle ≤ 5°** on BellaBot ([Pudu](https://www.pudurobotics.com/en/products/bellabot)). Any threshold, ramp, or patio step kills the route.

### Where it falls apart

**(a) The direct-import supply base is mostly not robot companies.** Filter the Made-in-China supplier list for "restaurant delivery robot" and what comes back is largely Zhengzhou/Henan **food-machinery trading companies** — Henan Foodyoo, Henan Foodyee, Henan Foodline, Henan Foodmax, Zhengzhou Hento, Zhengzhou Honest Machinery — whose stated main products are oil presses, palletizers, biscuit machines, and seafood processing lines ([supplier list](https://www.made-in-china.com/manufacturers-suppliers/restaurant-delivery-robot.html)). They are re-listing someone else's robot. Buying from them, you have no manufacturer relationship, no firmware channel, and no parts. The genuine robot manufacturers in that pool are a short list — **Shenzhen Reeman** (ISO9001:2015, own-brand + ODM, USD 3,380–6,900, MOQ 1–10), **Fujian Hantewin**, **Xiamen Muka** (ISO14001). Even those are ODM shops, not brands with a Canadian depot.

**(b) The certification story is unresolved and it is not cosmetic.** Every China-sourced robot I could find lists **CE only** ([RobotSourced on the T8](https://robotsourced.com/robots/service/keenon-t8/)). CE is a manufacturer self-declaration and **is not recognised in Canada**. Ontario Regulation 438/07 and the Ontario Electrical Safety Code require approval by an SCC-accredited body — CSA, cUL, cETL, Nemko, QAI, TÜV, Intertek — before an electrical product is *used, sold, displayed, or advertised for sale* in Ontario ([ESA bulletin](http://www.eesa.tech/uploads/9/2/1/8/92180466/esa_marks.pdf)). Separately, anything with Wi-Fi, Bluetooth, or 4G needs an **ISED certification and IC number** and must be listed in the Radio Equipment List before it can be imported, distributed, or offered for sale — **FCC approval does not satisfy this** ([ISED](https://ised-isde.canada.ca/site/spectrum-management-telecommunications/en/licences-and-certificates/radio-authorizations/wireless-equipment-certification)). A robot has both a mains-charged battery system and multiple radios. Two certification exposures on one SKU, and the importer of record — Surge — carries both.

**(c) Nobody publishes robot prices, which tells you what kind of sale it is.** Pudu themselves are demo-request-only. Nova Dynamic, Canada's national Pudu dealer, publishes **no prices at all** ([novadynamic.ca](https://www.novadynamic.ca/)). RoboTools is the outlier and is worth reading closely — because their rental page is the most honest document in this brief.

**(d) The rental math is brutal for the end customer.** RoboTools rents the BellaBot Pro at **CAD 1,997/mo (1 mo)** down to **CAD 1,698/mo on a 12-month term — CAD 20,376 total** ([robotools.ca](https://robotools.ca/product/pudu-bellabot-pro-premium-autonomous-delivery-advertising-robot-for-rent/)). The same robot is **CAD 21,000 to buy outright** from the same vendor. The customer pays essentially the entire purchase price in year one and owns nothing. To their credit RoboTools bundles the charging station, technical support, service and consumables, and offers rent-to-own — but if Surge fronts this to a restaurant as a labour-saving lease, the operator will run that arithmetic and it will not land well. If Surge does offer robots, **sell them, don't lease them**, or be very explicit about what the service component is worth.

**(e) The adoption failure modes are non-technical.** Staff route around the robot when it is slower than walking. Hosts stop clearing its path. Someone puts a full tray of drinks on tray 4 and the 5° climb limit meets the ramp to the patio. None of this shows up on a spec sheet and all of it shows up on Surge's support line.

### If Surge does it anyway

Buy **through the Canadian channel**, not direct. Specifically: **PuduBot 2 at CAD 13,440** is the sensible entry SKU — marker-less VSLAM+ so no floor-code installation, 12–15 h battery, 40 kg, and the lowest published Canadian price of any of these ([RoboTools](https://robotools.ca/product-category/delivery-robots/)). It is also less "cute" than BellaBot, which is a feature for QSR and a bug for family dining. Pair it with a distributor SLA in writing. Do not be the importer of record on the first ten units.

---

## 4. Core POS stack — per category

All Loyalty Sense POS prices below are confirmed **CAD** (verified via the storefront's own currency object: `{country: "CA", currency: {active: "CAD"}}`) — a Canadian distributor with Toronto, Calgary and Vancouver presence ([loyaltysensepos.com](https://loyaltysensepos.com/collections/pos-printers)). FOB prices are Made-in-China, USD, MOQ-dependent, and exclude everything in §2.

### 4.1 Thermal receipt printers (80mm, LAN + Bluetooth, ESC/POS)

**This is the category where the ESC/POS detail actually bites.**

| Model | Connectivity | Notes | CAD (Loyalty Sense) |
|---|---|---|---|
| **Epson TM-m30III-H** | USB, LAN, Wi-Fi, **Bluetooth** | Native ESC/POS. 80/58 mm. 300 mm/s, 203 dpi. Autocutter 2.2 M cuts, 65 M MCBF lines, MTBF 360,000 h, 24-mo carry-in ([Epson EU](https://www.epson.eu/en_EU/products/retail/pos-printers/mpos-&-tablet-pos-printers/epson-tm-m30iii-(151):-wi-fi-+-bluetooth-model,-white,-eu/p/34463)) | **$527.99** |
| Epson TM-T88VII OmniLink | multiple | The workhorse. Native ESC/POS | from **$564.99** |
| Epson TM-m10 | — | 58 mm, small-footprint counter | from **$250.99** |
| Star TSP143IVUE | USB-C, LAN, CloudPRNT, AOA | ⚠️ see below | **$442.99** |
| Star TSP143IIILAN | Ethernet | ⚠️ see below | **$464.99** |
| Star TSP143IIIBi2 | Bluetooth (iOS/Android) | ⚠️ see below | **$522.99** |
| Star mC-Print3 MCP31 | LAN + USB (+ BT option) | Desktop series — DIP-switch emulation | from **$577.99** |
| Citizen CT-S801III | — | 80 mm | from **$450.99** |
| **FOB China reference** | USB/BT/LAN/Wi-Fi optional | OCOM OCPP-80S, SPRT SP-POS8811A / POS895, HPRT, Scangle | **USD 18–56**, MOQ 1–50 ([MIC](https://www.made-in-china.com/products-search/hot-china-products/80mm_Thermal_Receipt_Printer.html)) |

> **⚠️ ESC/POS gotcha on Star TSP100/TSP143 — read before speccing.**
> The TSP100 family ships in **StarLine mode**, not ESC/POS. Switching it requires the **Windows-only "Configuration Utility TSP100"**, and you must *additionally* tick **"Enable ESC/POS Routing"** under Print Job Routing — Star's own doc warns that without it "some applications may use Star Line Mode parsing, resulting in corrupted printing." You also have to pick 42 vs 48 chars/line and Star-standard vs ESC/POS-compatible resolution pitch ([Star KB](https://starmicronics.com/help-center/knowledge-base/how-to-change-the-emulation-on-star-tsp100-series-printers/)).
> For an iPad/cloud POS shipping raw ESC/POS to port 9100, that is a Windows laptop per install and a support ticket generator. Star's **desktop** printers (TSP650II, TSP743II, mC-Print3) switch emulation via **physical DIP switches** instead ([Star KB](https://starmicronics.com/help-center/knowledge-base/how-to-change-the-emulation-on-star-desktop-printers/)) — much better.
> **Recommendation: standardise on Epson TM-series (native ESC/POS, zero config).** Offer Star only as an mC-Print3/TSP650II-class desktop unit for customers who insist. Avoid TSP143 as the default bundle SKU.

**Bixolon** (SRP-Q300, SRP-350plusV) is the third credible option — 80 mm, ESC/POS, USB+Ethernet standard, up to 400 mm/s on the 350plusV ([Bixolon](https://www.bixolon.com/product_view.php?idx=191), [Bixolon EU](https://bixoloneu.com/product/srp-350plusv/)). I could **not** confirm cUL/CSA marking from public pages — FCC Part 15 is documented, Canadian certification is not. Ask before speccing.

### 4.2 Kitchen printers (heat-resistant + buzzer)

Thermal paper discolours in kitchen heat; impact dot-matrix does not. Every serious kitchen printer here is impact.

| Model | Interface | CAD |
|---|---|---|
| **Epson TM-U220IID** — impact, Ethernet LAN | LAN | from **$467.99** |
| Epson TM-U220IIB — impact, kitchen | Parallel / — | **$498.99** (kitchen variant) / **$399.99** (parallel) |
| Epson TM-U220B | Serial/parallel | from **$534.99** |
| **Star SP742ME** — impact, LAN, autocutter, internal PSU | Ethernet | **$541.99** |
| Star SP742 (USB) | USB | **$411.99** — *listed sold out* |

Source: [Loyalty Sense POS printers](https://loyaltysensepos.com/collections/pos-printers)

**Buzzers — the detail everyone forgets:**
- **Epson OT-BZ20** external buzzer with volume control. Works with **TM-U220II** — **not** with the original TM-U220 ([Epson](https://epson.com/Accessories/POS-Accessories/External-Buzzer-OT-BZ20/p/C32C890634)). It plugs into the **cash-drawer port**, so **you cannot run a buzzer and a cash drawer on the same printer**. In practice fine (kitchen printer has no drawer), but it means your expo printer can't do both.
- **Star BU01-24-A** external buzzer, plugs into the **RJ11** port, compatible with SP700 / 650 / TSP143 / TSP743 series; sounds on print job ([POSSupply](https://www.possupply.com/star-micronics-bu0124a-printer-external-buzzer)). On SP742 the cut-triggered buzz exists but **is not enabled by default** — a config step for the install checklist.

### 4.3 Cash drawers (RJ11/RJ12, printer-driven)

**The import candidate.**

| Model | Config | CAD (Loyalty Sense) |
|---|---|---|
| M-S Cash Drawer J-423 Smart, 16" | cable incl. | **$178.99** *(sold out)* |
| Star CD4 Choice, 16×16, printer-driven | — | from **$184.99** |
| APG VB320-BL1616 standard duty | — | **$203.99** |
| Star CD4-1416 Choice mini | — | **$214.99** |
| Star CD4-1616 | 5 bill / 5 coin, 2 media slots, cable incl. | **$224.99** |
| Star CD3-1313 Value mini | — | **$231.99** |
| Wasp WCD5000 all-metal | — | **$258.99** |
| APG Series 4000 1816 heavy duty | — | **$382.99** |

| FOB China | MOQ | USD |
|---|---|---|
| Guangzhou Yoko **YK-335A** heavy-duty metal, **12V RJ11** | 1 pc | **12.60–13.50** |
| Shenzhen Yuhengda 4 bill / 5 coin + media slot | 1 pc | **14.99–17.99** |
| Foshan Suntek metal lock box | 1 pc | **16.00–35.00** |
| Guangzhou GSAN black RJ11 12V | 100 pcs | **22.50–32.50** |
| EB International **CB-170** 6 bill / 8 coin flip-top | 1 pc | **38.00–50.00** |

Source: [Loyalty Sense cash drawers](https://loyaltysensepos.com/collections/cash-drawers), [MIC POS cash drawer](https://www.made-in-china.com/products-search/hot-china-products/POS_Cash_Drawer.html)

**Why this one works:** a cash drawer is a steel box with a solenoid. It has no radio (no ISED exposure), it is driven at 12/24 V off the printer's RJ11 port rather than plugged into mains (materially lower electrical-approval exposure than a mains-powered device — **confirm with your certifier, don't assume**), and its failure mode is a stuck solenoid, not a fire. ~CAD 31 landed against a CAD 185–225 Canadian street price is the widest spread in this brief.

### 4.4 Barcode scanners (1D/2D)

| Model | CAD |
|---|---|
| POS-X ION-SE1-ACU short range | $75.99 *(sold out)* |
| Unitech MS836 laser + stand | $91.99 |
| POS-X ION-SG1-ACU-K kit | $140.99 |
| Star BSH-20U wired 1D/2D (mC-Print/mPOP compatible) | **$187.99** |
| Wasp WWS110i cordless BT pocket | $218.99 |
| Wasp WDI4200 1D/2D USB | $285.99 *(sold out)* |
| Star wireless BT 2D | from $290.99 |
| Zebra DS2200 1D/2D corded | **$302.99** |
| Honeywell Voyager 1200g | $318.99 |
| Wasp WWS250i 1D/2D pocket | $444.99 |
| Socket Mobile S720 1D/2D + dock | from $421.99 |
| Honeywell Xenon XP 1950g | $589.99 *(sold out)* |

| FOB China (Shenzhen Yuhengda) | USD |
|---|---|
| 2D CMOS USB handheld | **6.99–8.99** |
| 2D CMOS wireless + stand | **9.99** |
| 2D desktop omnidirectional, auto-sense | **14.49–19.99** |
| 2D BT wireless + charging base | **27.99–29.99** |
| IP67 rugged 2D, 433 MHz wireless | **54.99** |

Source: [Loyalty Sense scanners](https://loyaltysensepos.com/collections/barcode-scanners), [MIC 2D scanners](https://www.made-in-china.com/products-search/hot-china-products/2D_Barcode_Scanner.html)

**Note:** the Canadian distributor's entire dedicated scanner collection showed **sold out** on 2026-09-10 — 7 of 7 products. Deeper stock exists under general search (Zebra DS2200, Star BSH-20U in stock). That's a supply-depth signal: don't build a bundle around a scanner SKU you can't reliably get. **Drop-ship this category.** Restaurant attach rate is low outside retail-adjacent concepts (bottle shops, grocery-cafés, ghost-kitchen pick-and-pack).

### 4.5 iPad stands / enclosures + card-reader mounts

| Product | CAD |
|---|---|
| Vault Mountable Stability Base | from **$142.99** |
| Compulocks Space iPad Enclosure, wall mount | from **$170.99** |
| Elo 2-position adjustable table-top stand w/ signage | from **$120.99** |
| Elo Mount tabletop stand (I-Series 10" / 1002L) | **$212.99** |
| nCLOSE enclosure, iPad 10.2 (7th gen) | **$223.99** |
| Elo Slim self-service **countertop** stand | **$413.99** |
| Elo Flip Stand | **$412.99** |
| Compulocks BrandMe tiltable kiosk **floor** stand | from **$471.99** |
| Elo Wallaby POS stand w/ flip | **$491.99** |
| Vault Pro enclosure, iPad 10.2 | **$500.00** |
| Elo Slim self-service **floor** stand | **$1,145.99** |
| **Star mPOP** — integrated printer + drawer + tablet stand, USB-C/Lightning | **$901.99** |

| FOB China | MOQ | USD |
|---|---|---|
| Shenzhen HCC **PS-20** universal tablet POS stand w/ retention lock | 1 pc | **22.00–25.00** |
| EB International **PS-20A** (iPad Air / Pro) | 1 pc | **22.00–29.00** |
| HCC **PS-20B** all-metal dual stand | 1 pc | **32.00–35.00** |
| EB International **PS-84** 360° rotatable metal | 2 pcs | **15.00–20.00** |
| Peacemounts adjustable gooseneck dual-screen | 100 pcs | **7.00–27.00** |

Source: [Loyalty Sense "stand"](https://loyaltysensepos.com/search?q=stand&type=product), [MIC POS tablet stand](https://www.made-in-china.com/products-search/hot-china-products/POS_Tablet_Stand.html)

The **Star mPOP at $901.99** is worth a hard look as *the* Surge bundle SKU: printer + cash drawer + tablet stand in one unit, one power cable, one box, one install. It removes three cabling failure modes from every deployment. The margin is worse than buying parts separately; the support cost is dramatically lower. That trade is usually worth it for a company whose promise is "call us and it works."

Counter stands are a good import candidate (no radio, no mains). **Card-reader mounts** are terminal-specific (Clover / PAX / Ingenico / Square housings differ) — I found no generic listing worth citing. Source these from whoever supplies Surge's terminals; don't try to generic-source them.

### 4.6 Customer-facing displays

| Product | CAD |
|---|---|
| POS-X XP8200 customer pole display | **$200.99** |
| Acer V176L b 17" LCD | $209.99 |
| ViewSonic VG1655 15.6" | $334.99 |
| Lenovo ThinkCentre TIO27 27" | $669.99 |
| Elo 1517L desktop touch monitor | $907.99 |

| FOB China | MOQ | USD |
|---|---|---|
| OCOM LED 8-char pole display | 1 pc | **33.00–39.00** |
| OCOM small USB LCD customer display | 2 pcs | **35.00** |
| Scangle 7" pole IPS, adjustable | 1 pc | **69.00–79.00** |
| HCC HCD101 10.1" LCD pole, HDMI | 1 pc | **88.00–98.00** |
| Scangle 9.7" industrial LCD + VESA + alloy stand | 1 pc | **88.00–100.00** |

Source: [Loyalty Sense "stand"](https://loyaltysensepos.com/search?q=stand&type=product), [MIC POS customer display](https://www.made-in-china.com/products-search/hot-china-products/POS_Customer_Display.html)

**Skip.** In an iPad-based restaurant POS, the customer-facing display is usually either (a) the payment terminal's own screen, or (b) a second iPad Surge is already selling. A dedicated pole display is a legacy-retail artefact and adds a driver/integration surface for very little revenue. Revisit if Surge lands a grocery or bottle-shop vertical where line-item display is a genuine expectation.

### 4.7 Label printers (prep / date labelling)

| Model | CAD |
|---|---|
| Brother PTE110VP industrial durable label maker | **$106.99** |
| **DYMO LabelWriter 550** | **$240.99** |
| DYMO LabelWriter 550 Turbo | $246.99 |
| DYMO LabelWriter Wireless | from $351.99 |
| DYMO LabelWriter 5XL | $392.99 |
| Zebra ZD410 compact direct thermal | **$499.99** |
| Star TSP143IV X4 **Liner-Free** (sticky paper) | **$675.99** |
| Wasp WPL304 4" desktop barcode printer | from $648.99 |
| Brother PT-P950NW | $762.99 |
| Star mC-Label3 MCL32CI (LAN/USB, cutter) | $818.99 |

Source: [Loyalty Sense "label printer"](https://loyaltysensepos.com/search?q=label+printer&type=product)

**Drop-ship.** Real demand exists (food-safety date labelling is a genuine operational need and a good upsell hook into HACCP conversations), but this is commodity Brother/DYMO/Zebra hardware with no integration story. The one interesting SKU is the **Star TSP143IV X4 Liner-Free at $675.99** — sticky receipt paper for delivery-bag sealing and order labelling from the same ESC/POS pipeline Surge already targets. That is worth a pilot with a delivery-heavy customer. (Note the TSP100 ESC/POS caveat in §4.1 applies here too.)

### 4.8 KDS bump bars / screens

| Product | CAD |
|---|---|
| **Logic Controls Bump Bars** | **$224.99** |
| **Logic Controls KB1700** kitchen display bump bar, Legend Sheet B | **$285.00** |
| Elo 1517L 15" desktop touch monitor | $907.99 |
| Acer V176L b 17" | $209.99 |
| Cherry G86-62401 compact keyboard w/ touchpad | $165.99 |
| APC Back-UPS 600VA 120V, 7 NEMA outlets | **$164.99** |

Source: [Loyalty Sense "bump bar"](https://loyaltysensepos.com/search?q=bump+bar&type=product)

**Bundle the bump bar, drop-ship the screen.** The **Logic Controls KB1700** is the de facto standard and is small enough to warehouse. KDS screens are generic monitors — let the customer buy a TV, or drop-ship. **Add the APC Back-UPS to every bundle**: at $164.99 it is the cheapest support-ticket insurance Surge can sell, and a KDS that survives a brownout is a very concrete "we thought about your restaurant" moment.

---

## 5. Canada deployment blockers — read before importing anything

These are the ones that will actually stop a shipment or a sale.

### 5.1 Electrical certification — the hard stop

An electrical product must be approved by an **SCC-accredited certification body** before it is *used, sold, displayed, or advertised for sale* in Ontario. Ontario Regulation 438/07 and the Ontario Electrical Safety Code list the recognised bodies: CSA, UL/ULC, Intertek (ETL), Nemko, QAI, TÜV America, TÜV Rheinland, Labtest, NSF, OMNI, FM Approvals, Curtis Strauss, Entela ([ESA marks bulletin](http://www.eesa.tech/uploads/9/2/1/8/92180466/esa_marks.pdf)).

**A CE mark is a manufacturer self-declaration and is not recognised in Canada.** Nearly every China-sourced listing in this brief shows CE (and sometimes FCC/RoHS) and nothing else.

**Practical consequence:** if Surge imports a mains-powered device with CE only, it cannot legally be sold or even *advertised* in Ontario until it carries a cUL/CSA/cETL mark. Field evaluation by an accredited body is possible but is priced per-unit-ish and destroys the margin case on small volumes. This is why cash drawers (low-voltage, printer-driven) are the sensible import and printers/robots are not.

### 5.2 Radio certification — the second hard stop

Anything with **Wi-Fi, Bluetooth, 4G, UWB, or RFID** requires **ISED certification, an IC number, and a listing in the Radio Equipment List** before it can be imported, distributed, or offered for sale in Canada. **FCC certification does not satisfy this** — it is a separate authorisation ([ISED Wireless equipment certification](https://ised-isde.canada.ca/site/spectrum-management-telecommunications/en/licences-and-certificates/radio-authorizations/wireless-equipment-certification)). The obligation sits on manufacturers, importers, distributors **and sellers** — i.e. on Surge in every one of those roles.

This kills the "cheap Bluetooth thermal printer from Shenzhen" plan on its own, independent of the electrical issue.

### 5.3 Quebec — French language (Charter of the French Language / Law 14, "Bill 96")

If Surge sells into Quebec, or into a national chain with Quebec locations:

- Anything **written on the product** must appear in French — including **packaging, instruction manuals, warranty cards, promotional inserts, and any object supplied with the product** ([McCarthy Tétrault](https://www.mccarthy.ca/en/insights/blogs/consumer-markets-perspectives/french-language-requirements-bill-96-and-june-1-2025-common-misconceptions), [BLG](https://www.blg.com/en/insights/2024/02/quebec-proposes-amendments-and-clarifications-to-bill-96-requirements-part-i)).
- Since **1 June 2025**, descriptive/generic terms in a non-French language that form part of a trademark must be translated.
- A sell-off grace period runs to **1 June 2027** for products manufactured before 1 June 2025 that meet specific trademark conditions.

**Consequence:** a white-label printer that ships with an English-only quick-start card is non-compliant in Quebec. Branded incumbents (Epson, Star, Zebra) already ship bilingual Canadian documentation. This is another quiet reason distributor-sourced hardware is cheaper than it looks.

### 5.4 Power

North American **120 V / 60 Hz, NEMA 5-15**. Chinese factories will supply a 110–240 V PSU on request, but confirm the **plug type on the actual shipped SKU**, not the datasheet. Robots ship with a charging dock — confirm dock input voltage and plug separately from the robot.

### 5.5 Duty and tariff

Electronics from China into Canada generally fall in a **0–6% MFN** band; China is a WTO member but not an FTA partner, so MFN applies and preferential rates should not be assumed ([EpicSourcing](https://www.epicsourcing.ca/post/canada-china-import-duties-2026-guide)). Canada's GPT/LDCT program changes took effect 1 January 2025 ([EY](https://www.ey.com/en_gl/technical/tax-alerts/canadas-updates-to-developing-country-tariff-preference-programs-and-direct-shipment-requirements-come-into-force-in-2025)).

**I could not verify the specific rate for any HS code.** The CBSA Customs Tariff 2026 Chapter 84 HTML page publishes only the chapter notes; the rate schedule is in the PDF ([CBSA Ch.84 T2026](https://www.cbsa-asfc.gc.ca/trade-commerce/tariff-tarif/2026/html/00/ch84-eng.html)), and the [Canada Tariff Finder](https://www.tariffinder.ca/en/) is an interactive form I did not submit. **Get a broker to classify and rate the actual SKUs before committing to a PO.** The 4% used in §2 is a placeholder, not a finding.

### 5.6 Warranty / RMA / local service

| Path | Warranty | Service reality |
|---|---|---|
| Canadian distributor (Loyalty Sense etc.) | e.g. **1-year limited manufacturer warranty** on Star TSP143IIILAN ([product page](https://loyaltysensepos.com/products/star-micronics-tsp143iiilan-ethernet-lan-thermal-receipt-printer)); Epson TM-m30III carries **24-month carry-in** | Domestic RMA, domestic stock, someone to phone |
| Direct import | Whatever the factory says. Xiamen Muka lists a 1-year warranty period; most listings say nothing | Ship the unit back to China, or eat it and send a replacement from your own stock |
| Robots via Canadian channel | RoboTools rentals include support, service and consumables ([page](https://robotools.ca/product/pudu-bellabot-pro-premium-autonomous-delivery-advertising-robot-for-rent/)); Pudu's NA service partner **Burroughs** claims 2 repair depots, 2 technical support centres, 120+ forward stocking locations and 500 technicians across US and Canada ([Pudu](https://www.pudurobotics.com/about/news/677bc0b7c3c5d30043096487)) | This is the entire reason to pay the channel price |

**On direct import, Surge becomes the warranty.** For a company selling "a local person on the phone," that is not a minor accounting detail — it is a change in what the business is.

---

## 6. Direct-from-Alibaba vs. distributor — the recommendation

**Buy from a Canadian distributor for everything that plugs into the wall, has a radio, or can generate a support call. Import only cash drawers and possibly counter-top tablet stands.**

The case for distributor:

- **The margin gap is smaller than it looks.** A distributor's ~CAD 465 LAN printer against a ~USD 25 FOB unit looks like a 20x spread, but once you add cUL/CSA certification (§5.1), ISED certification (§5.2), French documentation (§5.3), freight, brokerage, duty, DOA stock, and a warranty reserve, the real gap on a *legally sellable, supportable* printer is a fraction of that.
- **Next-day replacement is the product.** A restaurant with a dead receipt printer at 6pm Friday is not a hardware problem, it is a churn event. A GTA distributor can courier a replacement. Shenzhen cannot.
- **Regulatory liability transfers.** Buying a cUL-marked, ISED-listed, bilingual-boxed Epson from a Canadian distributor means Surge is not the importer of record and not the party ESA or ISED talks to.
- **It matches the brand promise.** Surge is selling reliability and a human. Every dollar of unit margin clawed back from an uncertified import is spent twice over on the support desk.

The case for direct import, where it holds:

- Cash drawers. Low-voltage, no radio, dumb, heavy, ~CAD 31 landed vs ~CAD 185–225 street. Do it.
- Counter-top tablet stands. No electronics at all (PS-20/PS-84 class, USD 15–35). Do it, and consider laser-etching the Surge logo — a branded stand on every counter is cheap marketing.
- Consumables (thermal paper rolls) — not researched here, but the same logic applies and the reorder revenue is recurring.

**Middle path worth considering:** find a **North American ODM importer** who has already done the cUL + ISED work on a white-label 80mm printer, and private-label from them. You get most of the import margin without owning the certification. I did not identify a specific such partner in this research — that would be the next piece of work.

---

## 7. Suggested bundle

| Tier | Contents | Approx. hardware cost (CAD, distributor) |
|---|---|---|
| **Essential** | Epson TM-m30III-H receipt printer, imported cash drawer, counter tablet stand, APC Back-UPS | ~$730 (printer $528 + drawer ~$31 landed + stand ~$35 landed + UPS $165) |
| **Full service** | + Epson TM-U220IID kitchen printer + OT-BZ20 buzzer, Logic Controls KB1700 bump bar | + ~$790 |
| **Counter-forward** | Star mPOP (printer + drawer + stand in one) instead of separates | $902 |
| **Drop-ship menu** | Zebra DS2200 scanner ($303), DYMO LabelWriter 550 ($241), Elo/Compulocks floor stand ($413–$492), KDS monitor | quoted per order |
| **Refer, don't stock** | Pudu / KEENON robots via Canadian distributor | — |

The **Essential** tier is the one to optimise. It has one mains device with native ESC/POS and zero emulation config, one imported item with the best margin in the catalogue, and a UPS that quietly prevents a class of support call.

---

## Appendix A — what I could NOT verify

Listing this explicitly, because guessing here would be worse than useless.

| Item | Status |
|---|---|
| **Alibaba.com pricing, suppliers, Gold/Verified status, response rates, years active, price-break tiers** | **Not obtained.** Search served a slider CAPTCHA; showroom and product-detail URLs returned "No results". Not solvable within scope. FOB figures here are Made-in-China substitutes. |
| Alibaba supplier "Gold Supplier" / "Verified" / "years active" / "response rate" badges | **Not obtained** — same blocker. Made-in-China shows "Certified" flags and response-time bands (≤3h) but not Alibaba's badge taxonomy. |
| RobotShop Canada CAD robot pricing | **Blocked** by Cloudflare bot check. |
| POSGuys.com US comparison pricing | **Blocked** by Cloudflare bot check. |
| Specific HS-code duty rates | **Not verified.** CBSA HTML publishes chapter notes only; Tariff Finder is an interactive form I did not submit. The 4% in §2 is a placeholder. |
| Nova Dynamic (national Pudu dealer) pricing | **Quote-only.** No public prices. |
| Pudu Robotics direct pricing | **Quote-only.** Demo request form. |
| KEENON DinerBot T8 price | **Third-party estimate**, not a manufacturer or distributor price. RobotSourced states "US reseller listings (estimated)", range USD 5,500–11,000. Treat ±40%. |
| Bixolon cUL/CSA marking | **Not confirmed.** FCC Part 15 documented; Canadian certification not found on public pages. |
| Whether printer-driven (12V RJ11) cash drawers escape Ontario electrical approval | **Assumed, not confirmed.** Reasonable, but confirm with a certifier before importing 100 units. |
| Card-reader mounts | **Not found** as a generic sourceable category — terminal-specific. |
| Ocean freight quote for Surge's actual volumes | **Not obtainable** without contacting a forwarder. §2 uses published rate bands. |
| Bear Robotics Servi Canadian availability / service | **Not researched.** Price is a US integrator list price. LG holds a 51% majority stake (Jan 2025, [LG](https://www.lg.com/global/newsroom/news/corporate/lg-acquires-majority-stake-in-bear-robotics-to-bolster-robotics-capabilities/)), which may mean a stronger NA service path than the Chinese brands — unverified. |

### Data conflicts noticed

**BellaBot specs disagree between vendor and manufacturer.** RobotLAB lists tray dimensions 38.5/27.5/11.5 cm and battery "max 10–12 hours" ([RobotLAB](https://www.robotlab.com/store/bellabot/)); Pudu's own page states tray size 41.00 × 50.01 cm, tray heights 23.01/19.99/19.99/18.01 cm, and battery life 13 h unloaded ([Pudu](https://www.pudurobotics.com/en/products/bellabot)). **Use the manufacturer figures**, and be aware that integrator spec sheets in this category are loose. Much of RobotLAB's own comparison table reads "Contact for details" — including navigation type and minimum path clearance, the two specs that determine whether a robot fits a given restaurant.

---

## Appendix B — source index

**Robots**
- Pudu BellaBot — https://www.pudurobotics.com/en/products/bellabot
- Pudu PuduBot 2 — https://www.pudurobotics.com/en/products/pudubot2
- Pudu × Burroughs NA service partnership — https://www.pudurobotics.com/about/news/677bc0b7c3c5d30043096487
- RobotLAB BellaBot (USD 14,500) — https://www.robotlab.com/store/bellabot/
- RobotLAB BellaBot Pro (USD 16,000) — https://www.robotlab.com/store/bellabot-pro/
- RoboTools Canada delivery robots (CAD) — https://robotools.ca/product-category/delivery-robots/
- RoboTools BellaBot Pro rental (CAD 1,698–1,997/mo) — https://robotools.ca/product/pudu-bellabot-pro-premium-autonomous-delivery-advertising-robot-for-rent/
- Nova Dynamic (national Pudu dealer, no pricing) — https://www.novadynamic.ca/
- RobotSourced KEENON DinerBot T8 — https://robotsourced.com/robots/service/keenon-t8/
- LG majority stake in Bear Robotics — https://www.lg.com/global/newsroom/news/corporate/lg-acquires-majority-stake-in-bear-robotics-to-bolster-robotics-capabilities/

**Canadian distributor pricing (CAD confirmed)**
- POS printers — https://loyaltysensepos.com/collections/pos-printers
- Cash drawers — https://loyaltysensepos.com/collections/cash-drawers
- Barcode scanners — https://loyaltysensepos.com/collections/barcode-scanners
- Stands / displays — https://loyaltysensepos.com/search?q=stand&type=product
- Label printers — https://loyaltysensepos.com/search?q=label+printer&type=product
- Bump bars — https://loyaltysensepos.com/search?q=bump+bar&type=product
- iPad enclosures — https://loyaltysensepos.com/search?q=ipad&type=product
- Star TSP143IIILAN (warranty terms) — https://loyaltysensepos.com/products/star-micronics-tsp143iiilan-ethernet-lan-thermal-receipt-printer

**FOB China (Made-in-China.com — Alibaba substitute)**
- Restaurant delivery robots — https://www.made-in-china.com/products-search/hot-china-products/Restaurant_Delivery_Robot.html
- Robot supplier list — https://www.made-in-china.com/manufacturers-suppliers/restaurant-delivery-robot.html
- 80mm thermal receipt printers — https://www.made-in-china.com/products-search/hot-china-products/80mm_Thermal_Receipt_Printer.html
- POS cash drawers — https://www.made-in-china.com/products-search/hot-china-products/POS_Cash_Drawer.html
- 2D barcode scanners — https://www.made-in-china.com/products-search/hot-china-products/2D_Barcode_Scanner.html
- POS tablet stands — https://www.made-in-china.com/products-search/hot-china-products/POS_Tablet_Stand.html
- POS customer displays — https://www.made-in-china.com/products-search/hot-china-products/POS_Customer_Display.html

**Printer technical (ESC/POS)**
- Star: change emulation on TSP100 series — https://starmicronics.com/help-center/knowledge-base/how-to-change-the-emulation-on-star-tsp100-series-printers/
- Star: change emulation on desktop printers (DIP switches) — https://starmicronics.com/help-center/knowledge-base/how-to-change-the-emulation-on-star-desktop-printers/
- Star ESC/POS command spec — https://www.starmicronics.com/support/Mannualfolder/escpos_cm_en.pdf
- Star SP742 impact printer — https://starmicronics.com/product/sp742-impact-printer-kitchen-restaurant-orders-tickets/
- Star SP700 buzzer config app note — https://www.starmicronics.com/help-center/wp-content/uploads/2020/08/Application-Note-SP700-buzzer-config-3.pdf
- Star BU01-24-A external buzzer — https://www.possupply.com/star-micronics-bu0124a-printer-external-buzzer
- Epson OT-BZ20 external buzzer — https://epson.com/Accessories/POS-Accessories/External-Buzzer-OT-BZ20/p/C32C890634
- Epson TM-U220 receipt/kitchen printer — https://epson.com/For-Work/POS-System-Devices/POS-Printers/TM-U220-Receipt-Kitchen-Printer/p/C31C514653
- Epson TM-m30III specs — https://www.epson.eu/en_EU/products/retail/pos-printers/mpos-&-tablet-pos-printers/epson-tm-m30iii-(151):-wi-fi-+-bluetooth-model,-white,-eu/p/34463
- Bixolon SRP-Q300 — https://www.bixolon.com/product_view.php?idx=191
- Bixolon SRP-350plusV — https://bixoloneu.com/product/srp-350plusv/

**Regulatory / landed cost**
- ESA Ontario recognised certification marks — http://www.eesa.tech/uploads/9/2/1/8/92180466/esa_marks.pdf
- ISED wireless equipment certification — https://ised-isde.canada.ca/site/spectrum-management-telecommunications/en/licences-and-certificates/radio-authorizations/wireless-equipment-certification
- Bill 96 / June 2025 — McCarthy Tétrault — https://www.mccarthy.ca/en/insights/blogs/consumer-markets-perspectives/french-language-requirements-bill-96-and-june-1-2025-common-misconceptions
- Bill 96 product markings — BLG — https://www.blg.com/en/insights/2024/02/quebec-proposes-amendments-and-clarifications-to-bill-96-requirements-part-i
- CBSA Customs Tariff 2026, Ch.84 — https://www.cbsa-asfc.gc.ca/trade-commerce/tariff-tarif/2026/html/00/ch84-eng.html
- Canada Tariff Finder — https://www.tariffinder.ca/en/
- Canada–China import duties 2026 — https://www.epicsourcing.ca/post/canada-china-import-duties-2026-guide
- Canada GPT/LDCT changes 2025 — EY — https://www.ey.com/en_gl/technical/tax-alerts/canadas-updates-to-developing-country-tariff-preference-programs-and-direct-shipment-requirements-come-into-force-in-2025
- LCL cost per CBM 2026 — https://suaidglobal.com/insights/lcl-cost-per-cbm/
- LCL rates 2026 — https://www.freightamigo.com/en/blog/logistics/lcl-shipping-freight-rates-for-containers-complete-2026-guide/
- Customs brokerage fees Canada — https://www.gcityservices.ca/knowledge-centre/customs-brokerage-clearance/customs-brokerage-fees-canada
- USD/CAD — https://tradingeconomics.com/canada/currency
