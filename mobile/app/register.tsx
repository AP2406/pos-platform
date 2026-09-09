import { useEffect, useMemo, useReducer, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, ScanBarcode, Tag, Users, Clock, Send, CreditCard, Split, Printer, TriangleAlert, ChefHat, CircleCheck, Hash, MoreHorizontal, Trash2 } from "lucide-react-native";
import {
  Button,
  MenuTile,
  CartLine,
  SegmentedTabs,
  SearchField,
  SeatTab,
  NumPad,
  BottomSheet,
  ModifierSheet,
  CategoryRail,
  MenuItemSheet,
  EmptyState,
  ScanSheet,
  StatusChip,
  color,
  space,
  radius,
  text,
  type SheetItem,
  type SheetInitial,
  type ConfirmSpec,
  type ScanResult,
} from "@/design";
import { categoryIcon } from "@/lib/category-icons";
import { barcodeIndex, matchBarcode } from "@/lib/barcode";
import { useSession } from "@/state/session";
import { fetchMenu, fetchCheckCart, fetchCheckHeader, fetchCourses, fetchUpsells, fetchTables, type MenuItem, type Course, type UpsellPrompt, type MoveTarget, type CheckHeader } from "@/lib/reads";
import { itemNeedsSheet, itemRequiresChoice, type ModPosition } from "@/lib/modifiers";
import { ALLERGENS, allergyString } from "@/lib/allergens";
import { quote, fire, appendToTicket } from "@/lib/api";
import { printKitchenChit, printReceipt } from "@/lib/printing";
import { cartReducer, initialCart, cartSubtotal, cartSeats, lineEffectiveTotal, lineEffectiveUnit, lineDiscountAmount, type DiningOption, type CartLine as Line, type LineDiscount } from "@/state/cart";
import { money } from "@/lib/format";

type Suggestion = { item: MenuItem; label: string; discount: number };

const DINING: { key: DiningOption; label: string }[] = [
  { key: "dine_in", label: "Dine-in" },
  { key: "takeout", label: "Takeout" },
  { key: "pickup", label: "Pickup" },
  { key: "delivery", label: "Delivery" },
];
const DINING_LABEL: Record<DiningOption, string> = { dine_in: "Dine-in", takeout: "Takeout", pickup: "Pickup", delivery: "Delivery" };

const timeOf = (iso: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
const round2 = (n: number) => Math.round(n * 100) / 100;

export default function Register() {
  const s = useSession();
  const router = useRouter();
  const params = useLocalSearchParams<{ ticket?: string; mode?: string; table?: string; element?: string }>();

  const [cart, dispatch] = useReducer(cartReducer, initialCart);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [upsells, setUpsells] = useState<UpsellPrompt[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [cat, setCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  // Tax comes from the server (canonical rates); subtotal/total are ALWAYS derived
  // from the lines on screen so the check can never disagree with itself.
  const [tax, setTax] = useState(0);
  const [customOpen, setCustomOpen] = useState(false);
  const [customPrice, setCustomPrice] = useState("");
  const [splitOpen, setSplitOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [header, setHeader] = useState<CheckHeader | null>(null);
  const [openedAt] = useState(() => new Date().toISOString());

  // The open check id — from params, or captured from the first fire of a new check
  // so subsequent course fires append to the same ticket.
  const [ticketId, setTicketId] = useState<string | null>(params.ticket ?? null);

  // Modifier picker: the item being customized + (for edits) the line it came from.
  const [sheetItem, setSheetItem] = useState<SheetItem | null>(null);
  const [sheetInitial, setSheetInitial] = useState<SheetInitial | undefined>(undefined);
  const [editLineId, setEditLineId] = useState<string | null>(null);

  const [activeCourse, setActiveCourse] = useState(1);
  const [fireOpen, setFireOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [lineEditId, setLineEditId] = useState<string | null>(null);
  const [editAllergens, setEditAllergens] = useState<string[]>([]);
  const [editDiscKind, setEditDiscKind] = useState<LineDiscount["kind"]>("percent");
  const [editDiscVal, setEditDiscVal] = useState("");
  const [customMod, setCustomMod] = useState("");
  const [customModPrice, setCustomModPrice] = useState("");
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTargets, setMoveTargets] = useState<MoveTarget[]>([]);
  const [movingLineId, setMovingLineId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const bizId = s.businessId!;
  const staffId = s.staff?.id ?? null;
  const tableMode = !!params.element || !!header?.elementId;
  const coursingOn = tableMode && courses.length > 0;

  // Load menu + courses.
  useEffect(() => {
    (async () => {
      try {
        const [m, c, u] = await Promise.all([fetchMenu(bizId), fetchCourses(bizId), fetchUpsells(bizId)]);
        setMenu(m);
        setCourses(c);
        setUpsells(u);
      } catch {
        /* ignore */
      }
    })();
  }, [bizId]);

  useEffect(() => {
    if (params.mode === "togo") dispatch({ type: "SET_DINING", option: "takeout" });
    if (params.mode === "delivery") dispatch({ type: "SET_DINING", option: "delivery" });
    if (params.mode === "pickup") dispatch({ type: "SET_DINING", option: "pickup" });
    if (params.ticket) {
      (async () => {
        try {
          const [lines, head] = await Promise.all([fetchCheckCart(params.ticket!), fetchCheckHeader(params.ticket!)]);
          setHeader(head);
          if (head?.lastFiredAt) setLastSentAt(head.lastFiredAt);
          dispatch({
            type: "LOAD",
            lines: lines.map((l) => ({ catalogItemId: l.catalogItemId, variationId: null, name: l.name, unitPrice: l.unitPrice, quantity: l.quantity, seat: l.seat, course: 1, note: l.note, modifiers: null, allergy: null, discount: null, customized: false, firedQty: l.quantity })),
          });
        } catch {
          /* ignore */
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subtotal is the sum of the lines on screen — always, instantly.
  const subtotal = useMemo(() => round2(cartSubtotal(cart)), [cart]);
  const total = round2(subtotal + tax);

  // Tax via compute-only /api/v1/quote (the same math the eventual charge uses).
  // Only a finite, non-negative tax is accepted; anything else leaves tax at 0
  // rather than letting a bad response zero the whole check.
  useEffect(() => {
    // Tax on the DISCOUNTED per-unit price so the preview matches the discount.
    const items = cart.lines.map((l) => ({ catalog_item_id: l.catalogItemId, unit_price: lineEffectiveUnit(l), quantity: l.quantity }));
    if (items.length === 0) {
      setTax(0);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const q = await quote(bizId, staffId, { items });
        const serverTax = Number(q?.tax);
        if (!cancelled) setTax(Number.isFinite(serverTax) && serverTax >= 0 ? round2(serverTax) : 0);
      } catch {
        if (!cancelled) setTax(0);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [cart, bizId, staffId]);

  // Category rail: distinct icon + live item count per category.
  const railCats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of menu) {
      const c = m.category || "Other";
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const names = [...counts.keys()].sort((a, b) => a.localeCompare(b));
    return [
      { key: "all", label: "All", count: menu.length, Icon: categoryIcon("all") },
      ...names.map((c) => ({ key: c, label: c, count: counts.get(c) ?? 0, Icon: categoryIcon(c) })),
    ];
  }, [menu]);

  const shownMenu = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menu.filter((m) => (cat === "all" || (m.category || "Other") === cat) && (!q || m.name.toLowerCase().includes(q)));
  }, [menu, cat, search]);

  const seats = cartSeats(cart);
  const courseName = (n: number) => courses[n - 1]?.name ?? "Course " + n;
  const seatLabel = (n: number) => {
    const nm = (cart.seatNames[String(n)] || "").trim();
    return nm ? "S" + n + " · " + nm : "Seat " + n;
  };
  const LABEL_TO_KEY: Record<string, string> = Object.fromEntries(ALLERGENS.map((a) => [a.label, a.key]));

  // Open the line editor, seeding the allergen chips from the line's allergy string.
  function openLineEditor(l: Line) {
    setEditAllergens((l.allergy ?? "").split(",").map((s) => LABEL_TO_KEY[s.trim()]).filter(Boolean));
    setEditDiscKind(l.discount?.kind ?? "percent");
    setEditDiscVal(l.discount ? String(l.discount.value) : "");
    setCustomMod("");
    setCustomModPrice("");
    setLineEditId(l.id);
  }
  function toggleLineAllergen(lineId: string, key: string) {
    setEditAllergens((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      dispatch({ type: "SET_LINE_ALLERGY", id: lineId, allergy: next.length ? allergyString(next) : null });
      return next;
    });
  }
  function applyDiscount(id: string) {
    const v = Math.round((Number(editDiscVal) || 0) * 100) / 100;
    dispatch({ type: "SET_LINE_DISCOUNT", id, discount: v > 0 ? { kind: editDiscKind, value: v } : null });
  }
  function addCustomMod(id: string) {
    const name = customMod.trim();
    if (!name) return;
    dispatch({ type: "ADD_LINE_MODIFIER", id, name, price: Number(customModPrice) || 0 });
    setCustomMod("");
    setCustomModPrice("");
  }
  // Move an UNFIRED line to another table (order shaping — no kitchen ticket, no tender).
  async function openMove(l: Line) {
    setMovingLineId(l.id);
    setLineEditId(null);
    try {
      setMoveTargets(await fetchTables(bizId, params.element ?? null));
    } catch {
      setMoveTargets([]);
    }
    setMoveOpen(true);
  }
  async function doMove(target: MoveTarget) {
    const l = cart.lines.find((x) => x.id === movingLineId);
    if (!l || moving) return;
    setMoving(true);
    try {
      await appendToTicket(bizId, staffId, {
        elementId: target.elementId,
        label: target.label,
        item: { catalog_item_id: l.catalogItemId, name: l.name, unit_price: lineEffectiveUnit(l), quantity: l.quantity, note: l.note, seat: l.seat },
      });
      dispatch({ type: "REMOVE", id: l.id });
      Alert.alert("Moved", l.name + " is now on " + target.label + ".");
    } catch (e) {
      Alert.alert("Couldn't move", String((e as Error).message));
    } finally {
      setMoving(false);
      setMoveOpen(false);
      setMovingLineId(null);
    }
  }

  // The course a new line of this item lands on (its default course, else active).
  function courseForItem(m: MenuItem): number {
    if (!coursingOn) return 1;
    if (m.defaultCourseId) {
      const idx = courses.findIndex((c) => c.id === m.defaultCourseId);
      if (idx >= 0) return idx + 1;
    }
    return activeCourse;
  }

  // E6 suggestive-selling: when a trigger item/category is rung, surface its add-ons.
  function maybeUpsell(m: MenuItem) {
    if (upsells.length === 0) return;
    const matches = upsells.filter((p) => (p.triggerScope === "item" && p.triggerItemId === m.id) || (p.triggerScope === "category" && !!p.triggerCategory && (m.category || "") === p.triggerCategory));
    const out: Suggestion[] = [];
    for (const p of matches) {
      const si = menu.find((x) => x.id === p.suggestItemId);
      if (!si || si.outOfStock || out.some((s) => s.item.id === si.id)) continue;
      out.push({ item: si, label: p.label || "Add " + si.name + "?", discount: p.comboDiscount });
    }
    if (out.length > 0) setSuggestions(out);
  }

  function soldOut(m: MenuItem) {
    Alert.alert("Sold out", m.name + " is marked sold out for today.");
  }

  // Tap a menu tile: force the picker for items with sizes/forced modifiers so a
  // line can never exist with an unmet required group; otherwise quick-add.
  function tapItem(m: MenuItem) {
    if (m.outOfStock) return soldOut(m);
    if (itemNeedsSheet(m)) {
      setEditLineId(null);
      setSheetInitial(undefined);
      setSheetItem(m);
      return;
    }
    dispatch({ type: "ADD", item: { catalogItemId: m.id, name: m.name, unitPrice: m.price }, course: courseForItem(m) });
    maybeUpsell(m);
  }

  // Fast path (long-press / "+"): add immediately, opening the picker ONLY when a
  // choice is genuinely required (a size or a group minimum) so known-item entry
  // stays a single tap.
  function quickAdd(m: MenuItem) {
    if (m.outOfStock) return soldOut(m);
    if (itemRequiresChoice(m)) {
      setEditLineId(null);
      setSheetInitial(undefined);
      setSheetItem(m);
      return;
    }
    dispatch({ type: "ADD", item: { catalogItemId: m.id, name: m.name, unitPrice: m.price }, course: courseForItem(m) });
    maybeUpsell(m);
  }

  // Barcode/UPC scan → catalog match over the already-loaded menu (in-memory).
  const codeIndex = useMemo(() => barcodeIndex(menu), [menu]);
  function onScan(code: string): ScanResult {
    const m = matchBarcode(codeIndex, code);
    if (!m) return { found: false };
    if (m.outOfStock) return { found: false, message: m.name + " is sold out" };
    if (itemRequiresChoice(m)) {
      // Needs a size/required option — close the scanner and open the picker.
      setScanOpen(false);
      setEditLineId(null);
      setSheetInitial(undefined);
      setSheetItem(m);
      return { found: true, name: m.name };
    }
    dispatch({ type: "ADD", item: { catalogItemId: m.id, name: m.name, unitPrice: m.price }, course: courseForItem(m) });
    return { found: true, name: m.name };
  }

  function onSheetConfirm(spec: ConfirmSpec) {
    if (editLineId) {
      dispatch({ type: "REPLACE_LINE", id: editLineId, spec: { catalogItemId: spec.catalogItemId, variationId: spec.variationId, name: spec.name, unitPrice: spec.unitPrice, note: spec.note, modifiers: spec.modifiers } });
    } else {
      const m = menu.find((x) => x.id === spec.catalogItemId);
      dispatch({ type: "ADD_LINE", spec: { catalogItemId: spec.catalogItemId, variationId: spec.variationId, name: spec.name, unitPrice: spec.unitPrice, note: spec.note, modifiers: spec.modifiers, allergy: spec.allergy, course: m ? courseForItem(m) : activeCourse } });
      if (m) maybeUpsell(m);
    }
    setSheetItem(null);
    setEditLineId(null);
  }

  // Add a suggested upsell: items needing choices open the picker (combo discount
  // skipped there); simple items drop straight in at the discounted combo price.
  function addSuggested(sug: Suggestion) {
    setSuggestions(null);
    if (itemNeedsSheet(sug.item)) {
      tapItem(sug.item);
      return;
    }
    const price = Math.max(0, Math.round((sug.item.price - sug.discount) * 100) / 100);
    dispatch({ type: "ADD", item: { catalogItemId: sug.item.id, name: sug.item.name, unitPrice: price }, course: courseForItem(sug.item) });
  }

  // Re-open the picker on an existing customized line, prefilled from its modifiers.
  function editLineOptions(l: Line) {
    const m = menu.find((x) => x.id === l.catalogItemId);
    if (!m) return;
    const positions: Record<string, ModPosition> = {};
    for (const mod of l.modifiers ?? []) if (mod.modifier_id && mod.position && mod.position !== "whole") positions[mod.modifier_id] = mod.position;
    setSheetInitial({
      variationId: l.variationId,
      selected: (l.modifiers ?? []).map((mod) => mod.modifier_id).filter((x): x is string => !!x),
      positions,
      note: l.note ?? "",
    });
    setEditLineId(l.id);
    setLineEditId(null);
    setSheetItem(m);
  }

  function addCustom() {
    const price = Math.round((Number(customPrice) || 0) * 100) / 100;
    if (price > 0) dispatch({ type: "ADD", item: { catalogItemId: null, name: "Open item", unitPrice: price }, course: coursingOn ? activeCourse : 1 });
    setCustomPrice("");
    setCustomOpen(false);
  }
  function onCustomKey(k: string) {
    if (k === "back") setCustomPrice((p) => p.slice(0, -1));
    else if (k === "." && !customPrice.includes(".")) setCustomPrice((p) => p + ".");
    else if (/[0-9]/.test(k)) setCustomPrice((p) => p + k);
  }

  // Fire a set of (unfired) lines to the kitchen — money-independent. Persists the
  // open check + kitchen tickets, captures the ticket id for later course fires.
  async function fireLines(lines: Line[], label: string, andExit: boolean) {
    const unfired = lines.filter((l) => l.firedQty < l.quantity);
    if (unfired.length === 0 || sending) return;
    setSending(true);
    try {
      const items = unfired.map((l) => ({ catalog_item_id: l.catalogItemId, name: l.name, unit_price: l.unitPrice, quantity: l.quantity - l.firedQty, note: l.note, seat: l.seat, allergy: l.allergy }));
      const res = await fire(bizId, staffId, {
        ticketId,
        elementId: params.element ?? null,
        label,
        ticketType: params.element ? "table" : params.mode === "tab" ? "bar" : "togo",
        channel: cart.diningOption,
        items,
      });
      setTicketId(res.ticketId);
      setLastSentAt(new Date().toISOString());
      dispatch({ type: "MARK_FIRED", ids: unfired.map((l) => l.id) });
      // Print the kitchen chit (skips cleanly when no printer is connected —
      // never blocks or fails the fire).
      printKitchenChit(s.deviceProfile.printerTarget, {
        label,
        items: unfired.map((l) => ({ name: l.name, quantity: l.quantity - l.firedQty, note: l.note, allergy: l.allergy, seat: l.seat })),
        firedAt: new Date().toISOString(),
      }).catch(() => {});
      if (andExit) {
        Alert.alert("Sent to kitchen", res.fired + (res.fired === 1 ? " item is" : " items are") + " on the way.");
        dispatch({ type: "CLEAR" });
        router.replace("/floor");
      }
    } catch (e) {
      Alert.alert("Couldn't send", String((e as Error).message));
    } finally {
      setSending(false);
    }
  }

  const baseLabel = header?.label || params.table || (params.mode === "togo" ? "Takeout" : params.mode === "delivery" ? "Delivery" : params.mode === "pickup" ? "Pickup" : params.mode === "tab" ? "Tab" : "New check");
  const unfiredCount = cart.lines.reduce((n, l) => n + Math.max(0, l.quantity - l.firedQty), 0);
  const itemCount = cart.lines.reduce((n, l) => n + l.quantity, 0);
  const sentCount = cart.lines.reduce((n, l) => n + Math.min(l.quantity, l.firedQty), 0);
  const payable = total > 0 && cart.lines.length > 0;

  // Drop every line that hasn't gone to the kitchen yet (sent lines stay).
  function clearUnsent() {
    const ids = cart.lines.filter((l) => l.firedQty === 0).map((l) => l.id);
    if (ids.length === 0) return;
    Alert.alert("Remove unsent items?", ids.length + (ids.length === 1 ? " item" : " items") + " will be taken off the check. Items already in the kitchen stay.", [
      { text: "Keep", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => { for (const id of ids) dispatch({ type: "REMOVE", id }); setMoreOpen(false); } },
    ]);
  }

  async function fireCourse(n: number) {
    await fireLines(cart.lines.filter((l) => l.course === n), baseLabel + " · " + courseName(n), false);
    setFireOpen(false);
  }
  async function fireAll() {
    await fireLines(cart.lines, baseLabel, !coursingOn);
    setFireOpen(false);
  }

  // Present the check: prints an itemized check to this device's printer.
  async function printCheck() {
    if (printing) return;
    setPrinting(true);
    try {
      const res = await printReceipt(s.deviceProfile.printerTarget, {
        businessName: s.businessName ?? "Surge",
        saleNumber: null,
        createdAt: new Date().toISOString(),
        items: cart.lines.map((l) => ({ name: l.name, quantity: l.quantity, unitPrice: lineEffectiveUnit(l) })),
        subtotal,
        discount: 0,
        tax,
        tip: 0,
        total,
        payments: [],
      });
      if (!res.ok) Alert.alert("Couldn't print", res.error);
      else if (res.printed) Alert.alert("Check printed", "Sent to this iPad's printer.");
      else if (!s.deviceProfile.printerTarget) Alert.alert("No printer set up", "Choose a printer for this iPad in Device settings, then try again.");
      else Alert.alert("Printer not connected", "This iPad can't reach the printer right now. Check that it's powered on and on the same Wi-Fi.");
    } finally {
      setPrinting(false);
    }
  }

  const editLine = cart.lines.find((l) => l.id === lineEditId) ?? null;
  const serverName = header?.serverName ?? s.staff?.name?.split(" ")[0] ?? null;
  const guests = header?.guests ?? 0;
  const opened = header?.openedAt ?? openedAt;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.row}>
        {/* Menu side */}
        <View style={styles.menuSide}>
          <View style={styles.menuHeader}>
            <Pressable onPress={() => router.replace("/floor")} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to Floor">
              <ChevronLeft size={20} color={color.text} strokeWidth={2.25} />
              <Text style={styles.backTxt}>Floor</Text>
            </Pressable>
            <View style={styles.searchWrap}>
              <SearchField value={search} onChangeText={setSearch} placeholder="Search the menu" />
            </View>
            <Button title="Scan" variant="secondary" icon={<ScanBarcode size={18} color={color.text} strokeWidth={2} />} onPress={() => setScanOpen(true)} />
            <Button title="Open item" variant="secondary" icon={<Tag size={18} color={color.text} strokeWidth={2} />} onPress={() => setCustomOpen(true)} />
          </View>
          <View style={styles.browse}>
            <CategoryRail categories={railCats} value={cat} onChange={setCat} />
            <ScrollView style={styles.gridScroll} contentContainerStyle={styles.menuGrid}>
              {shownMenu.map((m) => (
                <MenuTile
                  key={m.id}
                  name={m.name}
                  price={money(m.price, "CAD")}
                  imageUrl={m.imageUrl}
                  Icon={categoryIcon(m.category)}
                  dim={m.outOfStock}
                  onPress={() => setDetailItem(m)}
                  onLongPress={() => quickAdd(m)}
                  onQuickAdd={() => quickAdd(m)}
                />
              ))}
              {shownMenu.length === 0 && menu.length > 0 && <EmptyState title="No matches" body={search.trim() ? "Nothing on the menu matches “" + search.trim() + "”." : "This category has no items yet."} actionLabel={search.trim() ? "Clear search" : undefined} onAction={search.trim() ? () => setSearch("") : undefined} />}
              {menu.length === 0 && <EmptyState title="Menu is loading" body="Menu items come from your Surge catalog. If nothing appears, check the connection." />}
            </ScrollView>
          </View>
        </View>

        {/* Check side */}
        <View style={styles.cartSide}>
          {/* Check header — where, who, how many, since when */}
          <View style={styles.checkHead}>
            <View style={styles.checkTitleRow}>
              <Text style={styles.checkTitle} numberOfLines={1}>
                {baseLabel}
              </Text>
              <StatusChip tint={color.textDim} label={tableMode ? "Dine-in" : DINING_LABEL[cart.diningOption]} size="sm" />
            </View>
            <View style={styles.checkMeta}>
              {header?.number != null ? (
                <View style={styles.metaItem}>
                  <Hash size={14} color={color.textDim} strokeWidth={2.25} />
                  <Text style={styles.metaTxt}>{String(header.number)}</Text>
                </View>
              ) : null}
              {guests > 0 ? (
                <View style={styles.metaItem}>
                  <Users size={14} color={color.textDim} strokeWidth={2.25} />
                  <Text style={styles.metaTxt}>{guests + (guests === 1 ? " guest" : " guests")}</Text>
                </View>
              ) : null}
              {serverName ? (
                <View style={styles.metaItem}>
                  <ChefHat size={14} color={color.textDim} strokeWidth={2.25} />
                  <Text style={styles.metaTxt}>{serverName}</Text>
                </View>
              ) : null}
              <View style={styles.metaItem}>
                <Clock size={14} color={color.textDim} strokeWidth={2.25} />
                <Text style={styles.metaTxt}>{(header ? "Opened " : "Started ") + timeOf(opened)}</Text>
              </View>
            </View>
          </View>

          {!tableMode && <SegmentedTabs tabs={DINING} value={cart.diningOption} onChange={(o) => dispatch({ type: "SET_DINING", option: o })} />}

          {coursingOn && (
            <View style={styles.courseRow}>
              {courses.map((c, i) => (
                <SeatTab key={c.id} label={c.name} active={activeCourse === i + 1} onPress={() => setActiveCourse(i + 1)} />
              ))}
            </View>
          )}

          <View style={styles.seatRow}>
            <SeatTab label="Whole check" active={cart.activeSeat == null} onPress={() => dispatch({ type: "SET_ACTIVE_SEAT", seat: null })} />
            {seats.map((n) => (
              <SeatTab key={n} label={seatLabel(n)} active={cart.activeSeat === n} onPress={() => dispatch({ type: "SET_ACTIVE_SEAT", seat: n })} />
            ))}
            <SeatTab label="+ Seat" onPress={() => dispatch({ type: "SET_ACTIVE_SEAT", seat: (seats[seats.length - 1] ?? 0) + 1 })} />
          </View>

          {cart.activeSeat != null && (
            <TextInput
              value={cart.seatNames[String(cart.activeSeat)] ?? ""}
              onChangeText={(t) => dispatch({ type: "SET_SEAT_NAME", seat: cart.activeSeat as number, name: t })}
              placeholder={"Name for seat " + cart.activeSeat + " (optional)"}
              placeholderTextColor={color.textFaint}
              style={styles.seatName}
            />
          )}

          <ScrollView style={styles.lines} contentContainerStyle={styles.linesInner}>
            {cart.lines.length === 0 && <EmptyState compact title="No items yet" body="Tap a menu item to add it. Tap a line to change its seat, quantity, or discount." />}
            {cart.lines.map((l) => {
              const fired = l.firedQty >= l.quantity && l.quantity > 0;
              const disc = l.discount ? (l.discount.kind === "percent" ? l.discount.value + "% off" : money(l.discount.value, "CAD") + " off") : null;
              const tags = [l.seat != null ? seatLabel(l.seat) : null, coursingOn ? courseName(l.course) : null, disc, !fired && l.firedQty > 0 ? l.firedQty + " sent" : null].filter((x): x is string => !!x);
              return (
                <Pressable key={l.id} onPress={() => openLineEditor(l)} style={styles.lineRow} accessibilityRole="button" accessibilityLabel={"Edit " + l.name} accessibilityHint="Seat, quantity, discount, allergy">
                  <View style={{ flex: 1 }}>
                    <CartLine name={l.name} qty={l.quantity} price={money(lineEffectiveTotal(l), "CAD")} note={l.note ?? undefined} allergy={l.allergy ?? undefined} tags={tags} fired={fired} />
                  </View>
                  <ChevronRight size={16} color={color.textFaint} strokeWidth={2.25} style={styles.lineChevron} />
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.totals}>
            <Row label={"Subtotal" + (itemCount > 0 ? " · " + itemCount + (itemCount === 1 ? " item" : " items") : "")} value={money(subtotal, "CAD")} />
            <Row label="Tax" value={money(tax, "CAD")} />
            <Row label="Total" value={money(total, "CAD")} bold />
          </View>

          {/* Kitchen: an ACTION when something still needs to go, a STATUS once it's all sent.
              Blue is reserved for the button you can actually press. */}
          {unfiredCount > 0 ? (
            coursingOn ? (
              <Button title={"Fire course… · " + unfiredCount + (unfiredCount === 1 ? " item" : " items")} size="lg" icon={<Send size={18} color={color.onPrimary} strokeWidth={2.25} />} onPress={() => setFireOpen(true)} />
            ) : (
              <Button title={"Send " + unfiredCount + (unfiredCount === 1 ? " item" : " items") + " to kitchen"} size="lg" icon={<Send size={18} color={color.onPrimary} strokeWidth={2.25} />} onPress={() => fireLines(cart.lines, baseLabel, true)} loading={sending} />
            )
          ) : cart.lines.length > 0 ? (
            <View style={styles.sentRow} accessibilityRole="text">
              <CircleCheck size={18} color={color.success} strokeWidth={2.25} />
              <Text style={styles.sentTxt}>
                {"All " + sentCount + (sentCount === 1 ? " item" : " items") + " sent to kitchen"}
                {lastSentAt ? " · " + timeOf(lastSentAt) : ""}
              </Text>
            </View>
          ) : null}

          <View style={styles.pay}>
            <Button title="More" variant="ghost" icon={<MoreHorizontal size={18} color={color.text} strokeWidth={2} />} onPress={() => setMoreOpen(true)} disabled={cart.lines.length === 0} style={{ flex: 1 }} />
            <Button title={payable ? "Take payment · " + money(total, "CAD") : "Take payment"} variant={unfiredCount > 0 ? "secondary" : "primary"} icon={<CreditCard size={18} color={unfiredCount > 0 ? color.text : color.onPrimary} strokeWidth={2} />} onPress={() => setPayOpen(true)} disabled={!payable} style={{ flex: 1.6 }} />
          </View>
        </View>
      </View>

      {/* Barcode/UPC scan-to-add */}
      <ScanSheet visible={scanOpen} onClose={() => setScanOpen(false)} onCode={onScan} />

      {/* Catalog detail (read-only preview) → hands back to the add flow */}
      <MenuItemSheet
        item={detailItem}
        onClose={() => setDetailItem(null)}
        onAdd={(it) => {
          setDetailItem(null);
          const full = menu.find((m) => m.id === it.id);
          if (full) tapItem(full);
        }}
      />

      {/* Forced/nested modifier picker */}
      <ModifierSheet item={sheetItem} initial={sheetInitial} isEdit={!!editLineId} onClose={() => { setSheetItem(null); setEditLineId(null); }} onConfirm={onSheetConfirm} />

      {/* Fire by course */}
      <BottomSheet visible={fireOpen} onClose={() => setFireOpen(false)} title="Send to kitchen">
        {courses.map((c, i) => {
          const n = i + 1;
          const pending = cart.lines.filter((l) => l.course === n).reduce((x, l) => x + Math.max(0, l.quantity - l.firedQty), 0);
          return <Button key={c.id} title={c.name + (pending > 0 ? " · " + pending + (pending === 1 ? " item" : " items") : " · nothing new")} variant="secondary" disabled={pending === 0 || sending} onPress={() => fireCourse(n)} />;
        })}
        <Button title={"Send everything (" + unfiredCount + ")"} size="lg" onPress={fireAll} disabled={unfiredCount === 0 || sending} loading={sending} />
      </BottomSheet>

      {/* Suggestive-selling prompt */}
      <BottomSheet visible={!!suggestions} onClose={() => setSuggestions(null)} title="Add to the order?">
        {(suggestions ?? []).map((sug) => (
          <Pressable key={sug.item.id} onPress={() => addSuggested(sug)} style={styles.suggest}>
            <Text style={styles.suggestName}>{sug.label}</Text>
            <Text style={text.bodyDim}>
              {money(Math.max(0, sug.item.price - sug.discount), "CAD")}
              {sug.discount > 0 ? "  (save " + money(sug.discount, "CAD") + ")" : ""}
            </Text>
          </Pressable>
        ))}
        <Button title="No thanks" variant="ghost" onPress={() => setSuggestions(null)} />
      </BottomSheet>

      {/* Line editor — seat / course / options / remove */}
      <BottomSheet visible={!!editLine} onClose={() => setLineEditId(null)} title={editLine?.name}>
        {editLine ? (
          <ScrollView style={styles.editScroll} contentContainerStyle={styles.editInner} keyboardShouldPersistTaps="handled">
            <Text style={text.eyebrow}>Seat</Text>
            <View style={styles.seatRow}>
              <SeatTab label="Whole check" active={editLine.seat == null} onPress={() => dispatch({ type: "SET_LINE_SEAT", id: editLine.id, seat: null })} />
              {seats.map((n) => (
                <SeatTab key={n} label={seatLabel(n)} active={editLine.seat === n} onPress={() => dispatch({ type: "SET_LINE_SEAT", id: editLine.id, seat: n })} />
              ))}
              <SeatTab label="+ Seat" onPress={() => dispatch({ type: "SET_LINE_SEAT", id: editLine.id, seat: (seats[seats.length - 1] ?? 0) + 1 })} />
            </View>
            {coursingOn && (
              <>
                <Text style={text.eyebrow}>Course</Text>
                <View style={styles.seatRow}>
                  {courses.map((c, i) => (
                    <SeatTab key={c.id} label={c.name} active={editLine.course === i + 1} onPress={() => dispatch({ type: "SET_LINE_COURSE", id: editLine.id, course: i + 1 })} />
                  ))}
                </View>
              </>
            )}
            <Text style={text.eyebrow}>Allergy alert</Text>
            <View style={styles.chipRow}>
              {ALLERGENS.map((a) => {
                const on = editAllergens.includes(a.key);
                return (
                  <Pressable key={a.key} onPress={() => toggleLineAllergen(editLine.id, a.key)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                    {on ? <TriangleAlert size={13} color="#FFFFFF" strokeWidth={2.5} /> : null}
                    <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{a.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={text.eyebrow}>Quantity</Text>
            <View style={styles.editActions}>
              <Button title="−" variant="secondary" onPress={() => dispatch({ type: "DEC", id: editLine.id })} disabled={editLine.firedQty > 0 && editLine.quantity <= editLine.firedQty} style={{ flex: 1 }} />
              <Text style={styles.qtyVal}>{editLine.quantity}</Text>
              <Button title="+" variant="secondary" onPress={() => dispatch({ type: "INC", id: editLine.id })} style={{ flex: 1 }} />
            </View>

            {/* Per-item discount */}
            <Text style={text.eyebrow}>Discount</Text>
            <View style={styles.discRow}>
              <Pressable onPress={() => setEditDiscKind("percent")} style={[styles.discToggle, editDiscKind === "percent" && styles.discToggleOn]}>
                <Text style={[styles.discToggleTxt, editDiscKind === "percent" && { color: color.onPrimary }]}>%</Text>
              </Pressable>
              <Pressable onPress={() => setEditDiscKind("amount")} style={[styles.discToggle, editDiscKind === "amount" && styles.discToggleOn]}>
                <Text style={[styles.discToggleTxt, editDiscKind === "amount" && { color: color.onPrimary }]}>$</Text>
              </Pressable>
              <TextInput value={editDiscVal} onChangeText={setEditDiscVal} placeholder={editDiscKind === "percent" ? "0" : "0.00"} placeholderTextColor={color.textFaint} keyboardType="decimal-pad" style={styles.discInput} />
              <Button title="Apply" variant="secondary" onPress={() => applyDiscount(editLine.id)} />
              {editLine.discount ? <Button title="Clear" variant="ghost" onPress={() => { dispatch({ type: "SET_LINE_DISCOUNT", id: editLine.id, discount: null }); setEditDiscVal(""); }} /> : null}
            </View>
            {editLine.discount ? <Text style={text.caption}>{money(lineDiscountAmount(editLine), "CAD")} off · line total {money(lineEffectiveTotal(editLine), "CAD")}</Text> : null}

            {/* Free-text modifier (distinct from the kitchen Note) */}
            <Text style={text.eyebrow}>Add a modifier</Text>
            <View style={styles.discRow}>
              <TextInput value={customMod} onChangeText={setCustomMod} placeholder="e.g. extra hot, on the side" placeholderTextColor={color.textFaint} style={[styles.discInput, { flex: 3 }]} />
              <TextInput value={customModPrice} onChangeText={setCustomModPrice} placeholder="+$" placeholderTextColor={color.textFaint} keyboardType="decimal-pad" style={[styles.discInput, { flex: 1 }]} />
              <Button title="Add" variant="secondary" onPress={() => addCustomMod(editLine.id)} disabled={!customMod.trim()} />
            </View>

            {editLine.customized && editLine.firedQty === 0 && menu.some((m) => m.id === editLine.catalogItemId) && (
              <Button title="Change options" variant="secondary" onPress={() => editLineOptions(editLine)} />
            )}
            {editLine.firedQty === 0 ? (
              <View style={styles.editFooter}>
                <Button title="Move to another table" variant="secondary" onPress={() => openMove(editLine)} style={{ flex: 1 }} />
                <Button title="Remove" variant="danger" onPress={() => { dispatch({ type: "REMOVE", id: editLine.id }); setLineEditId(null); }} style={{ flex: 1 }} />
              </View>
            ) : (
              <Text style={text.caption}>This item is already in the kitchen, so it can't be moved or removed from here. Ask a manager to void it.</Text>
            )}
          </ScrollView>
        ) : null}
      </BottomSheet>

      {/* Move item → pick a destination table (unfired lines only) */}
      <BottomSheet visible={moveOpen} onClose={() => setMoveOpen(false)} title="Move item to a table">
        {moveTargets.length === 0 && <EmptyState compact title="No other tables" body="Add tables to this room in the Surge web dashboard." />}
        {moveTargets.map((t) => (
          <Button key={t.elementId} title={t.label + (t.occupied ? " · has an open check" : " · available")} variant="secondary" disabled={moving} onPress={() => doMove(t)} />
        ))}
      </BottomSheet>

      {/* Open item (custom price) */}
      <BottomSheet visible={customOpen} onClose={() => setCustomOpen(false)} title="Open item">
        <Text style={styles.customAmt}>{money(Number(customPrice) || 0, "CAD")}</Text>
        <NumPad onKey={onCustomKey} />
        <Button title="Add to check" size="lg" onPress={addCustom} disabled={!(Number(customPrice) > 0)} />
      </BottomSheet>

      {/* Split by seat — live per-seat shares of the check. */}
      <BottomSheet visible={splitOpen} onClose={() => setSplitOpen(false)} title="Split by seat">
        {seats.length === 0 && <EmptyState compact title="No seats yet" body="Assign items to seats (tap a line → Seat) to see each guest's share." />}
        {seats.map((n) => {
          const sub = cart.lines.filter((l) => l.seat === n).reduce((x, l) => x + lineEffectiveTotal(l), 0);
          return <Row key={n} label={seatLabel(n)} value={money(sub, "CAD")} />;
        })}
        {(() => {
          const shared = cart.lines.filter((l) => l.seat == null).reduce((x, l) => x + lineEffectiveTotal(l), 0);
          return shared > 0 ? <Row label="Shared (whole check)" value={money(shared, "CAD")} /> : null;
        })()}
        {seats.length > 0 ? <Text style={text.caption}>Before tax. Tap a line on the check to move it to a different seat.</Text> : null}
        <Button title="Done" variant="secondary" onPress={() => setSplitOpen(false)} />
      </BottomSheet>

      {/* More — everything else you can do with this check, all of it real. */}
      <BottomSheet visible={moreOpen} onClose={() => setMoreOpen(false)} title="Check options">
        <Button title="Split by seat" variant="secondary" icon={<Split size={18} color={color.text} strokeWidth={2} />} onPress={() => { setMoreOpen(false); setSplitOpen(true); }} />
        <Button title="Print check" variant="secondary" icon={<Printer size={18} color={color.text} strokeWidth={2} />} onPress={() => { setMoreOpen(false); printCheck(); }} disabled={cart.lines.length === 0} />
        <Button title={"Remove unsent items" + (unfiredCount > 0 ? " · " + unfiredCount : "")} variant="secondary" icon={<Trash2 size={18} color={color.text} strokeWidth={2} />} onPress={clearUnsent} disabled={unfiredCount === 0} />
        <Text style={text.caption}>Tap any line on the check to change its seat, quantity, discount or allergy note, or to move it to another table.</Text>
      </BottomSheet>

      {/* Take payment */}
      <BottomSheet visible={payOpen} onClose={() => setPayOpen(false)} title="Take payment">
        <View style={styles.payHero}>
          <Text style={text.caption}>Amount due</Text>
          <Text style={styles.payAmt}>{money(total, "CAD")}</Text>
          <Text style={text.caption}>
            {money(subtotal, "CAD")} + {money(tax, "CAD")} tax
            {unfiredCount > 0 ? " · " + unfiredCount + (unfiredCount === 1 ? " item not sent yet" : " items not sent yet") : ""}
          </Text>
        </View>
        <View style={styles.payNotice}>
          <CreditCard size={20} color={color.warning} strokeWidth={2} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.payNoticeTitle}>Card payments aren't set up on this iPad</Text>
            <Text style={styles.payNoticeBody}>Take payment on the front terminal, or print the check to bring to the table.</Text>
          </View>
        </View>
        <Button title="Print check" variant="secondary" icon={<Printer size={18} color={color.text} strokeWidth={2} />} onPress={printCheck} loading={printing} />
        <Button title="Close" variant="ghost" onPress={() => setPayOpen(false)} />
      </BottomSheet>
    </SafeAreaView>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.trow}>
      <Text style={bold ? text.bodyMedium : text.bodyDim}>{label}</Text>
      <Text style={[bold ? text.title : text.body, { fontVariant: ["tabular-nums"] }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  row: { flex: 1, flexDirection: "row" },
  menuSide: { flex: 1, padding: space.lg, gap: space.md },
  menuHeader: { flexDirection: "row", alignItems: "center", gap: space.sm },
  back: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 48, paddingRight: space.sm },
  backTxt: { fontFamily: "Poppins_500Medium", fontSize: 16, color: color.text },
  searchWrap: { flex: 1 },
  browse: { flex: 1, flexDirection: "row", gap: space.md },
  gridScroll: { flex: 1 },
  menuGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, paddingBottom: space.xl },
  cartSide: { width: "38%", minWidth: 372, maxWidth: 480, backgroundColor: color.card, borderLeftWidth: 1, borderLeftColor: color.border, padding: space.lg, gap: space.md },
  checkHead: { gap: 4 },
  checkTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  checkTitle: { flexShrink: 1, fontFamily: "Poppins_600SemiBold", fontSize: 24, color: color.text },
  checkMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.md, rowGap: 2 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaTxt: { fontFamily: "Poppins_500Medium", fontSize: 15, color: color.textDim },
  courseRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  seatRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  lines: { flex: 1 },
  linesInner: { paddingBottom: space.sm },
  lineRow: { flexDirection: "row", alignItems: "center" },
  lineChevron: { marginLeft: 6 },
  sentRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.control, backgroundColor: color.successSoft },
  sentTxt: { fontFamily: "Poppins_500Medium", fontSize: 15, color: color.text },
  totals: { gap: 6, paddingTop: space.md, borderTopWidth: 1, borderTopColor: color.border },
  trow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pay: { flexDirection: "row", gap: space.sm },
  customAmt: { color: color.text, fontSize: 34, fontFamily: "Poppins_600SemiBold", textAlign: "center", paddingVertical: space.sm, fontVariant: ["tabular-nums"] },
  editScroll: { maxHeight: 520 },
  editInner: { gap: space.sm },
  editActions: { flexDirection: "row", alignItems: "center", gap: space.md },
  editFooter: { flexDirection: "row", gap: space.sm, marginTop: space.xs },
  discRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  discToggle: { minHeight: 48, minWidth: 48, alignItems: "center", justifyContent: "center", borderRadius: radius.control, borderWidth: 1, borderColor: color.border, backgroundColor: color.card2 },
  discToggleOn: { borderColor: color.blue, backgroundColor: color.blue },
  discToggleTxt: { fontFamily: "Poppins_600SemiBold", fontSize: 16, color: color.textDim },
  discInput: { flex: 2, minHeight: 48, backgroundColor: color.card2, borderRadius: radius.control, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, paddingVertical: space.sm, color: color.text, fontFamily: "Poppins_400Regular", fontSize: 16 },
  qtyVal: { fontFamily: "Poppins_600SemiBold", fontSize: 22, color: color.text, minWidth: 40, textAlign: "center" },
  seatName: { minHeight: 44, backgroundColor: color.card2, borderRadius: radius.control, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, paddingVertical: space.sm, color: color.text, fontFamily: "Poppins_400Regular", fontSize: 15 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 36, paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, backgroundColor: color.card2 },
  chipOn: { backgroundColor: color.late, borderColor: color.late },
  chipTxt: { fontFamily: "Poppins_500Medium", fontSize: 14, color: color.textDim },
  chipTxtOn: { color: "#fff", fontFamily: "Poppins_600SemiBold" },
  suggest: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 56, padding: space.md, borderRadius: radius.control, borderWidth: 1, borderColor: color.border, backgroundColor: color.card2 },
  suggestName: { fontFamily: "Poppins_500Medium", fontSize: 16, color: color.text, flexShrink: 1 },
  payHero: { alignItems: "center", gap: 2, paddingVertical: space.sm },
  payAmt: { fontFamily: "Poppins_600SemiBold", fontSize: 40, color: color.text, fontVariant: ["tabular-nums"] },
  payNotice: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.card, backgroundColor: color.warningSoft, borderWidth: 1, borderColor: color.warning },
  payNoticeTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 16, color: color.text },
  payNoticeBody: { fontFamily: "Poppins_400Regular", fontSize: 14, color: color.textDim },
});
