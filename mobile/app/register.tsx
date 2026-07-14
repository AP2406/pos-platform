import { useEffect, useMemo, useReducer, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  color,
  space,
  radius,
  text,
  gradient,
  type SheetItem,
  type SheetInitial,
  type ConfirmSpec,
} from "@/design";
import { LinearGradient } from "expo-linear-gradient";
import { useSession } from "@/state/session";
import { fetchMenu, fetchCheckCart, fetchCourses, type MenuItem, type Course } from "@/lib/reads";
import { itemNeedsSheet, type ModPosition } from "@/lib/modifiers";
import { quote, verifyApprovals, fire } from "@/lib/api";
import { cartReducer, initialCart, cartSubtotal, cartSeats, type DiningOption, type CartLine as Line } from "@/state/cart";
import { money } from "@/lib/format";

const DINING: { key: DiningOption; label: string }[] = [
  { key: "dine_in", label: "Dine-in" },
  { key: "takeout", label: "Takeout" },
  { key: "delivery", label: "Delivery" },
  { key: "pickup", label: "Pickup" },
];

const ACTIONS: { label: string; permKey: string | null; sensitive: boolean }[] = [
  { label: "Discount", permKey: "discount", sensitive: true },
  { label: "Comp", permKey: "comp", sensitive: true },
  { label: "Tax exempt", permKey: "change_tax", sensitive: true },
  { label: "Tip", permKey: null, sensitive: false },
  { label: "Customer", permKey: null, sensitive: false },
  { label: "Note", permKey: null, sensitive: false },
];

export default function Register() {
  const s = useSession();
  const router = useRouter();
  const params = useLocalSearchParams<{ ticket?: string; mode?: string; table?: string; element?: string }>();

  const [cart, dispatch] = useReducer(cartReducer, initialCart);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [cat, setCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [totals, setTotals] = useState({ subtotal: 0, tax: 0, total: 0 });
  const [customOpen, setCustomOpen] = useState(false);
  const [customPrice, setCustomPrice] = useState("");
  const [splitOpen, setSplitOpen] = useState(false);

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

  const bizId = s.businessId!;
  const staffId = s.staff?.id ?? null;
  const tableMode = !!params.element;
  const coursingOn = tableMode && courses.length > 0;

  // Load menu + courses.
  useEffect(() => {
    (async () => {
      try {
        const [m, c] = await Promise.all([fetchMenu(bizId), fetchCourses(bizId)]);
        setMenu(m);
        setCourses(c);
      } catch {
        /* ignore */
      }
    })();
  }, [bizId]);

  useEffect(() => {
    if (params.mode === "togo") dispatch({ type: "SET_DINING", option: "takeout" });
    if (params.ticket) {
      (async () => {
        try {
          const lines = await fetchCheckCart(params.ticket!);
          dispatch({
            type: "LOAD",
            lines: lines.map((l) => ({ catalogItemId: l.catalogItemId, variationId: null, name: l.name, unitPrice: l.unitPrice, quantity: l.quantity, seat: l.seat, course: 1, note: l.note, modifiers: null, customized: false, firedQty: l.quantity })),
          });
        } catch {
          /* ignore */
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Totals via compute-only /api/v1/quote (matches the eventual charge).
  useEffect(() => {
    const items = cart.lines.map((l) => ({ catalog_item_id: l.catalogItemId, unit_price: l.unitPrice, quantity: l.quantity }));
    if (items.length === 0) {
      setTotals({ subtotal: 0, tax: 0, total: 0 });
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const q = await quote(bizId, staffId, { items });
        if (!cancelled) setTotals({ subtotal: q.subtotal, tax: q.tax, total: q.total });
      } catch {
        if (!cancelled) {
          const sub = cartSubtotal(cart);
          setTotals({ subtotal: sub, tax: 0, total: sub });
        }
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [cart, bizId, staffId]);

  const categories = useMemo(() => {
    const set: string[] = [];
    for (const m of menu) {
      const c = m.category || "Other";
      if (!set.includes(c)) set.push(c);
    }
    return [{ key: "all", label: "All" }, ...set.map((c) => ({ key: c, label: c }))];
  }, [menu]);

  const shownMenu = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menu.filter((m) => (cat === "all" || (m.category || "Other") === cat) && (!q || m.name.toLowerCase().includes(q)));
  }, [menu, cat, search]);

  const seats = cartSeats(cart);
  const courseName = (n: number) => courses[n - 1]?.name ?? "Course " + n;

  // The course a new line of this item lands on (its default course, else active).
  function courseForItem(m: MenuItem): number {
    if (!coursingOn) return 1;
    if (m.defaultCourseId) {
      const idx = courses.findIndex((c) => c.id === m.defaultCourseId);
      if (idx >= 0) return idx + 1;
    }
    return activeCourse;
  }

  // Tap a menu tile: force the picker for items with sizes/forced modifiers so a
  // line can never exist with an unmet required group; otherwise quick-add.
  function tapItem(m: MenuItem) {
    if (m.outOfStock) {
      Alert.alert("86'd", m.name + " is out of stock.");
      return;
    }
    if (itemNeedsSheet(m)) {
      setEditLineId(null);
      setSheetInitial(undefined);
      setSheetItem(m);
      return;
    }
    dispatch({ type: "ADD", item: { catalogItemId: m.id, name: m.name, unitPrice: m.price }, course: courseForItem(m) });
  }

  function onSheetConfirm(spec: ConfirmSpec) {
    if (editLineId) {
      dispatch({ type: "REPLACE_LINE", id: editLineId, spec: { catalogItemId: spec.catalogItemId, variationId: spec.variationId, name: spec.name, unitPrice: spec.unitPrice, note: spec.note, modifiers: spec.modifiers } });
    } else {
      const m = menu.find((x) => x.id === spec.catalogItemId);
      dispatch({ type: "ADD_LINE", spec: { catalogItemId: spec.catalogItemId, variationId: spec.variationId, name: spec.name, unitPrice: spec.unitPrice, note: spec.note, modifiers: spec.modifiers, course: m ? courseForItem(m) : activeCourse } });
    }
    setSheetItem(null);
    setEditLineId(null);
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
    if (price > 0) dispatch({ type: "ADD", item: { catalogItemId: null, name: "Custom", unitPrice: price }, course: coursingOn ? activeCourse : 1 });
    setCustomPrice("");
    setCustomOpen(false);
  }
  function onCustomKey(k: string) {
    if (k === "back") setCustomPrice((p) => p.slice(0, -1));
    else if (k === "." && !customPrice.includes(".")) setCustomPrice((p) => p + ".");
    else if (/[0-9]/.test(k)) setCustomPrice((p) => p + k);
  }

  async function onAction(a: (typeof ACTIONS)[number]) {
    if (!a.sensitive || !a.permKey) {
      Alert.alert(a.label, `${a.label} is part of the write path — deferred until the live money test.`);
      return;
    }
    try {
      const res = await verifyApprovals(bizId, staffId, { actions: [{ present: true, label: a.label, permKey: a.permKey, amount: null }] });
      if ("blocked" in res && res.blocked.length > 0) {
        Alert.alert("Manager approval required", `${a.label} needs a manager PIN. (Verification is live; applying ${a.label} is deferred until the live money test.)`);
      } else {
        Alert.alert(a.label, `Authorized. Applying ${a.label} is deferred until the live money test.`);
      }
    } catch (e) {
      Alert.alert("Couldn't verify", String((e as Error).message));
    }
  }

  function onCharge() {
    Alert.alert(
      "Charge — deferred",
      `Tender is wired to /api/v1/orders/:id/tender, which is held until your live $1 txn+refund test. Nothing was charged.\n\nTotal would be ${money(totals.total, "CAD")}.`
    );
  }

  // Fire a set of (unfired) lines to the kitchen — money-independent. Persists the
  // open check + kitchen tickets, captures the ticket id for later course fires.
  async function fireLines(lines: Line[], label: string, andExit: boolean) {
    const unfired = lines.filter((l) => l.firedQty < l.quantity);
    if (unfired.length === 0 || sending) return;
    setSending(true);
    try {
      const items = unfired.map((l) => ({ catalog_item_id: l.catalogItemId, name: l.name, unit_price: l.unitPrice, quantity: l.quantity - l.firedQty, note: l.note, seat: l.seat }));
      const res = await fire(bizId, staffId, {
        ticketId,
        elementId: params.element ?? null,
        label,
        ticketType: params.element ? "table" : params.mode === "tab" ? "bar" : "togo",
        channel: cart.diningOption,
        items,
      });
      setTicketId(res.ticketId);
      dispatch({ type: "MARK_FIRED", ids: unfired.map((l) => l.id) });
      if (andExit) {
        Alert.alert("Sent to kitchen", res.fired + (res.fired === 1 ? " item" : " items") + " fired.");
        dispatch({ type: "CLEAR" });
        router.replace("/floor");
      }
    } catch (e) {
      Alert.alert("Couldn't send", String((e as Error).message));
    } finally {
      setSending(false);
    }
  }

  const baseLabel = params.table || (params.mode === "togo" ? "Takeout" : params.mode === "tab" ? "Tab" : "Ticket");
  const unfiredCount = cart.lines.reduce((n, l) => n + Math.max(0, l.quantity - l.firedQty), 0);

  async function fireCourse(n: number) {
    await fireLines(cart.lines.filter((l) => l.course === n), baseLabel + " · " + courseName(n), false);
    setFireOpen(false);
  }
  async function fireAll() {
    await fireLines(cart.lines, baseLabel, !coursingOn);
    setFireOpen(false);
  }

  const editLine = cart.lines.find((l) => l.id === lineEditId) ?? null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.row}>
        {/* Menu side */}
        <View style={styles.menuSide}>
          <View style={styles.menuHeader}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={text.bodyDim}>‹ Floor</Text>
            </Pressable>
            <Button title="Custom" variant="secondary" onPress={() => setCustomOpen(true)} />
          </View>
          <SearchField value={search} onChangeText={setSearch} placeholder="Search menu" />
          <SegmentedTabs tabs={categories} value={cat} onChange={setCat} />
          <ScrollView contentContainerStyle={styles.menuGrid}>
            {shownMenu.map((m) => (
              <MenuTile key={m.id} name={m.name + (m.outOfStock ? " (86)" : "")} price={money(m.price, "CAD")} onPress={() => tapItem(m)} />
            ))}
            {shownMenu.length === 0 && <Text style={[text.bodyDim, { padding: space.md }]}>No items.</Text>}
          </ScrollView>
        </View>

        {/* Cart side */}
        <View style={styles.cartSide}>
          <SegmentedTabs tabs={DINING} value={cart.diningOption} onChange={(o) => dispatch({ type: "SET_DINING", option: o })} />

          {coursingOn && (
            <View style={styles.courseRow}>
              {courses.map((c, i) => (
                <SeatTab key={c.id} label={c.name} active={activeCourse === i + 1} onPress={() => setActiveCourse(i + 1)} />
              ))}
            </View>
          )}

          <View style={styles.seatRow}>
            <SeatTab label="Check" active={cart.activeSeat == null} onPress={() => dispatch({ type: "SET_ACTIVE_SEAT", seat: null })} />
            {seats.map((n) => (
              <SeatTab key={n} label={"Seat " + n} active={cart.activeSeat === n} onPress={() => dispatch({ type: "SET_ACTIVE_SEAT", seat: n })} />
            ))}
            <SeatTab label="+ Seat" onPress={() => dispatch({ type: "SET_ACTIVE_SEAT", seat: (seats[seats.length - 1] ?? 0) + 1 })} />
          </View>

          <ScrollView style={styles.lines}>
            {cart.lines.length === 0 && <Text style={[text.bodyDim, { paddingVertical: space.md }]}>Tap the menu to add items.</Text>}
            {cart.lines.map((l) => {
              const fired = l.firedQty >= l.quantity && l.quantity > 0;
              const tag = [l.seat != null ? "S" + l.seat : null, coursingOn ? courseName(l.course) : null, fired ? "✓ fired" : l.firedQty > 0 ? l.firedQty + " fired" : null].filter(Boolean).join(" · ");
              return (
                <Pressable key={l.id} onPress={() => setLineEditId(l.id)}>
                  <CartLine name={l.name + (tag ? "  · " + tag : "")} qty={l.quantity} price={money(l.unitPrice * l.quantity, "CAD")} note={l.note ?? undefined} />
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.actionsGrid}>
            {ACTIONS.map((a) => (
              <Pressable key={a.label} style={styles.actionBtn} onPress={() => onAction(a)}>
                <Text style={text.caption}>{a.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.totals}>
            <Row label="Subtotal" value={money(totals.subtotal, "CAD")} />
            <Row label="Tax" value={money(totals.tax, "CAD")} />
            <Row label="Total" value={money(totals.total, "CAD")} bold />
          </View>

          {coursingOn ? (
            <Button title={"Fire course…" + (unfiredCount > 0 ? " (" + unfiredCount + ")" : "")} onPress={() => setFireOpen(true)} disabled={unfiredCount === 0} style={{ marginBottom: space.sm }} />
          ) : (
            <Button title="Send to kitchen" onPress={() => fireLines(cart.lines, baseLabel, true)} loading={sending} disabled={unfiredCount === 0} style={{ marginBottom: space.sm }} />
          )}

          <View style={styles.pay}>
            <Button title="Split" variant="ghost" onPress={() => setSplitOpen(true)} style={{ flex: 1 }} />
            <Pressable style={{ flex: 2 }} onPress={onCharge} disabled={cart.lines.length === 0}>
              <LinearGradient colors={gradient.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.charge}>
                <Text style={styles.chargeTxt}>Charge {money(totals.total, "CAD")}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Forced/nested modifier picker */}
      <ModifierSheet item={sheetItem} initial={sheetInitial} isEdit={!!editLineId} onClose={() => { setSheetItem(null); setEditLineId(null); }} onConfirm={onSheetConfirm} />

      {/* Fire by course */}
      <BottomSheet visible={fireOpen} onClose={() => setFireOpen(false)} title="Fire to kitchen">
        {courses.map((c, i) => {
          const n = i + 1;
          const pending = cart.lines.filter((l) => l.course === n).reduce((x, l) => x + Math.max(0, l.quantity - l.firedQty), 0);
          return <Button key={c.id} title={c.name + (pending > 0 ? " · " + pending : " · nothing new")} variant="secondary" disabled={pending === 0 || sending} onPress={() => fireCourse(n)} />;
        })}
        <Button title={"Fire everything (" + unfiredCount + ")"} onPress={fireAll} disabled={unfiredCount === 0 || sending} loading={sending} />
      </BottomSheet>

      {/* Line editor — seat / course / options / remove */}
      <BottomSheet visible={!!editLine} onClose={() => setLineEditId(null)} title={editLine?.name}>
        {editLine ? (
          <>
            <Text style={text.caption}>Seat</Text>
            <View style={styles.seatRow}>
              <SeatTab label="Check" active={editLine.seat == null} onPress={() => dispatch({ type: "SET_LINE_SEAT", id: editLine.id, seat: null })} />
              {seats.map((n) => (
                <SeatTab key={n} label={"Seat " + n} active={editLine.seat === n} onPress={() => dispatch({ type: "SET_LINE_SEAT", id: editLine.id, seat: n })} />
              ))}
              <SeatTab label="+ Seat" onPress={() => dispatch({ type: "SET_LINE_SEAT", id: editLine.id, seat: (seats[seats.length - 1] ?? 0) + 1 })} />
            </View>
            {coursingOn && (
              <>
                <Text style={text.caption}>Course</Text>
                <View style={styles.seatRow}>
                  {courses.map((c, i) => (
                    <SeatTab key={c.id} label={c.name} active={editLine.course === i + 1} onPress={() => dispatch({ type: "SET_LINE_COURSE", id: editLine.id, course: i + 1 })} />
                  ))}
                </View>
              </>
            )}
            <View style={styles.editActions}>
              <Button title="−" variant="secondary" onPress={() => dispatch({ type: "DEC", id: editLine.id })} style={{ flex: 1 }} />
              <Text style={styles.qtyVal}>{editLine.quantity}</Text>
              <Button title="+" variant="secondary" onPress={() => dispatch({ type: "INC", id: editLine.id })} style={{ flex: 1 }} />
            </View>
            {editLine.customized && editLine.firedQty === 0 && menu.some((m) => m.id === editLine.catalogItemId) && (
              <Button title="Edit options" variant="secondary" onPress={() => editLineOptions(editLine)} />
            )}
            {editLine.firedQty === 0 ? (
              <Button title="Remove" variant="danger" onPress={() => { dispatch({ type: "REMOVE", id: editLine.id }); setLineEditId(null); }} />
            ) : (
              <Text style={text.caption}>Fired items can't be removed here — void them after charging.</Text>
            )}
          </>
        ) : null}
      </BottomSheet>

      {/* Custom price */}
      <BottomSheet visible={customOpen} onClose={() => setCustomOpen(false)} title="Custom amount">
        <Text style={styles.customAmt}>{money(Number(customPrice) || 0, "CAD")}</Text>
        <NumPad onKey={onCustomKey} />
        <Button title="Add" onPress={addCustom} disabled={!(Number(customPrice) > 0)} />
      </BottomSheet>

      {/* Split allocation (preview live; finalize stubbed) */}
      <BottomSheet visible={splitOpen} onClose={() => setSplitOpen(false)} title="Split by seat">
        {seats.length === 0 && <Text style={text.bodyDim}>Assign items to seats to split. (No seats yet.)</Text>}
        {seats.map((n) => {
          const sub = cart.lines.filter((l) => l.seat === n).reduce((x, l) => x + l.unitPrice * l.quantity, 0);
          return <Row key={n} label={"Seat " + n} value={money(sub, "CAD")} />;
        })}
        {(() => {
          const checkLevel = cart.lines.filter((l) => l.seat == null).reduce((x, l) => x + l.unitPrice * l.quantity, 0);
          return checkLevel > 0 ? <Row label="Unassigned" value={money(checkLevel, "CAD")} /> : null;
        })()}
        <Button title="Complete split — deferred" disabled onPress={() => {}} />
        <Text style={text.caption}>Allocation is live; finalizing a split is deferred until the money-write endpoints land.</Text>
      </BottomSheet>
    </SafeAreaView>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.trow}>
      <Text style={bold ? text.body : text.bodyDim}>{label}</Text>
      <Text style={[bold ? text.heading : text.body, { fontVariant: ["tabular-nums"] }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  row: { flex: 1, flexDirection: "row" },
  menuSide: { flex: 2, padding: space.lg, gap: space.sm },
  menuHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  menuGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, paddingVertical: space.md },
  cartSide: { width: 360, maxWidth: "45%", backgroundColor: color.card, borderLeftWidth: 1, borderLeftColor: color.border, padding: space.lg, gap: space.sm },
  courseRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  seatRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  lines: { flex: 1 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  actionBtn: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.card, backgroundColor: color.card2, borderWidth: 1, borderColor: color.border },
  totals: { gap: space.xs, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: color.border },
  trow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pay: { flexDirection: "row", gap: space.sm },
  charge: { minHeight: 56, borderRadius: radius.card, alignItems: "center", justifyContent: "center" },
  chargeTxt: { color: "#fff", fontSize: 18, fontWeight: "600" },
  customAmt: { color: color.text, fontSize: 32, textAlign: "center", paddingVertical: space.sm },
  editActions: { flexDirection: "row", alignItems: "center", gap: space.md, marginVertical: space.xs },
  qtyVal: { fontFamily: "Poppins_600SemiBold", fontSize: 18, color: color.text, minWidth: 32, textAlign: "center" },
});
