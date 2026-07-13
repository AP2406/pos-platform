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
  color,
  space,
  radius,
  text,
  gradient,
} from "@/design";
import { LinearGradient } from "expo-linear-gradient";
import { useSession } from "@/state/session";
import { fetchMenu, fetchCheckCart, type MenuItem } from "@/lib/reads";
import { quote, verifyApprovals } from "@/lib/api";
import { cartReducer, initialCart, cartSubtotal, cartSeats, type DiningOption } from "@/state/cart";
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
  const params = useLocalSearchParams<{ ticket?: string; mode?: string }>();

  const [cart, dispatch] = useReducer(cartReducer, initialCart);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cat, setCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [totals, setTotals] = useState({ subtotal: 0, tax: 0, total: 0 });
  const [customOpen, setCustomOpen] = useState(false);
  const [customPrice, setCustomPrice] = useState("");
  const [splitOpen, setSplitOpen] = useState(false);

  const bizId = s.businessId!;
  const staffId = s.staff?.id ?? null;

  // Load menu + (optionally) an existing check / mode.
  useEffect(() => {
    (async () => {
      try {
        setMenu(await fetchMenu(bizId));
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
            lines: lines.map((l) => ({ catalogItemId: l.catalogItemId, name: l.name, unitPrice: l.unitPrice, quantity: l.quantity, seat: l.seat, course: 1, note: l.note })),
          });
        } catch {
          /* ignore */
        }
      })();
    }
    // Only on first mount for these params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Totals via the compute-only /api/v1/quote (matches the eventual charge). Falls
  // back to a bare subtotal if the network hiccups.
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

  function addCustom() {
    const price = Math.round((Number(customPrice) || 0) * 100) / 100;
    if (price > 0) dispatch({ type: "ADD", item: { catalogItemId: null, name: "Custom", unitPrice: price } });
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
    // Sensitive: exercise the LIVE verify-only endpoint (no money moves). Applying
    // the action to the check is deferred.
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
      `Tender is wired to /api/v1/orders/:id/tender, which is held until your live $1 txn+refund test. Nothing was charged.\n\nTotal would be ${money(totals.total, s.businessId ? "CAD" : "CAD")}.`
    );
  }

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
              <MenuTile
                key={m.id}
                name={m.name}
                price={money(m.price, "CAD")}
                onPress={() => dispatch({ type: "ADD", item: { catalogItemId: m.id, name: m.name, unitPrice: m.price } })}
              />
            ))}
            {shownMenu.length === 0 && <Text style={[text.bodyDim, { padding: space.md }]}>No items.</Text>}
          </ScrollView>
        </View>

        {/* Cart side */}
        <View style={styles.cartSide}>
          <SegmentedTabs tabs={DINING} value={cart.diningOption} onChange={(o) => dispatch({ type: "SET_DINING", option: o })} />

          <View style={styles.seatRow}>
            <SeatTab label="Check" active={cart.activeSeat == null} onPress={() => dispatch({ type: "SET_ACTIVE_SEAT", seat: null })} />
            {seats.map((n) => (
              <SeatTab key={n} label={"Seat " + n} active={cart.activeSeat === n} onPress={() => dispatch({ type: "SET_ACTIVE_SEAT", seat: n })} />
            ))}
            <SeatTab label="+ Seat" onPress={() => dispatch({ type: "SET_ACTIVE_SEAT", seat: (seats[seats.length - 1] ?? 0) + 1 })} />
          </View>

          <ScrollView style={styles.lines}>
            {cart.lines.length === 0 && <Text style={[text.bodyDim, { paddingVertical: space.md }]}>Tap the menu to add items.</Text>}
            {cart.lines.map((l) => (
              <Pressable key={l.id} onLongPress={() => dispatch({ type: "REMOVE", id: l.id })}>
                <CartLine
                  name={l.name + (l.seat != null ? "  · S" + l.seat : "")}
                  qty={l.quantity}
                  price={money(l.unitPrice * l.quantity, "CAD")}
                  note={l.note ?? undefined}
                />
              </Pressable>
            ))}
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
        <Button
          title="Complete split — deferred"
          disabled
          onPress={() => {}}
        />
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
});
