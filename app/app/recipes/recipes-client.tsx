"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createIngredient,
  updateIngredient,
  deleteIngredient,
  saveRecipe,
  setIngredientStock,
  adjustIngredientStock,
} from "./actions";

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  cost: number;
  is_active: boolean;
  track_stock: boolean;
  stock_qty: number;
  reorder_point: number;
};

type Dish = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  is_active: boolean;
};

type Line = { ingredient_id: string; quantity: number };

const UNITS = ["unit", "each", "g", "kg", "ml", "L", "oz", "lb", "tbsp", "tsp", "cup", "slice"];

export function RecipesClient({
  initialIngredients,
  dishes,
  initialRecipes,
  currency,
  canManage,
}: {
  initialIngredients: Ingredient[];
  dishes: Dish[];
  initialRecipes: Record<string, Line[]>;
  currency: string;
  canManage: boolean;
}) {
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);
  const [recipes, setRecipes] = useState<Record<string, Line[]>>(initialRecipes);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const fmt = useMemo(
    () => (n: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n),
    [currency]
  );
  const ingById = useMemo(() => {
    const m = new Map<string, Ingredient>();
    for (const i of ingredients) m.set(i.id, i);
    return m;
  }, [ingredients]);

  function plateCost(dishId: string): number {
    const lines = recipes[dishId] || [];
    let total = 0;
    for (const l of lines) {
      const ing = ingById.get(l.ingredient_id);
      if (ing) total += ing.cost * l.quantity;
    }
    return Math.round(total * 10000) / 10000;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {err && <p className="text-sm text-red-600">{err}</p>}
      <IngredientsManager
        ingredients={ingredients}
        setIngredients={setIngredients}
        setRecipes={setRecipes}
        canManage={canManage}
        pending={pending}
        startTransition={startTransition}
        setErr={setErr}
        fmt={fmt}
      />
      <CostingTable
        dishes={dishes}
        ingredients={ingredients}
        recipes={recipes}
        setRecipes={setRecipes}
        canManage={canManage}
        pending={pending}
        startTransition={startTransition}
        setErr={setErr}
        fmt={fmt}
        plateCost={plateCost}
      />
    </div>
  );
}

/* -------------------------------- Ingredients -------------------------------- */

function IngredientsManager({
  ingredients,
  setIngredients,
  setRecipes,
  canManage,
  pending,
  startTransition,
  setErr,
  fmt,
}: {
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  setRecipes: React.Dispatch<React.SetStateAction<Record<string, Line[]>>>;
  canManage: boolean;
  pending: boolean;
  startTransition: React.TransitionStartFunction;
  setErr: (s: string | null) => void;
  fmt: (n: number) => string;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("unit");
  const [cost, setCost] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  function add() {
    setErr(null);
    if (name.trim().length < 1) {
      setErr("Enter an ingredient name.");
      return;
    }
    startTransition(async () => {
      const res = await createIngredient(name.trim(), unit, parseFloat(cost) || 0);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setIngredients((prev) =>
        [
          ...prev,
          {
            id: res.id,
            name: name.trim(),
            unit,
            cost: parseFloat(cost) || 0,
            is_active: true,
            track_stock: false,
            stock_qty: 0,
            reorder_point: 0,
          },
        ].sort((a, b) => a.name.localeCompare(b.name))
      );
      setName("");
      setCost("");
      setUnit("unit");
    });
  }

  function remove(id: string) {
    setErr(null);
    startTransition(async () => {
      const res = await deleteIngredient(id);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setIngredients((prev) => prev.filter((i) => i.id !== id));
      // Drop any recipe lines that used it so costs stay correct in the UI.
      setRecipes((prev) => {
        const next: Record<string, Line[]> = {};
        for (const [dish, lines] of Object.entries(prev)) {
          next[dish] = lines.filter((l) => l.ingredient_id !== id);
        }
        return next;
      });
      if (editId === id) setEditId(null);
    });
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-sm font-medium mb-1">Ingredients ({ingredients.length})</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Raw goods with a cost per unit. Used to cost every dish&apos;s recipe.
      </p>

      {canManage && (
        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ground beef"
              className="h-9 w-48"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Unit</Label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cost / unit</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.00"
              className="h-9 w-28 text-right"
            />
          </div>
          <Button size="sm" onClick={add} disabled={pending}>
            Add
          </Button>
        </div>
      )}

      {ingredients.length === 0 ? (
        <p className="text-sm text-muted-foreground">No ingredients yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {ingredients.map((ing) => (
            <div key={ing.id} className="py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-medium">{ing.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {fmt(ing.cost)} / {ing.unit}
                  </span>
                  {ing.track_stock && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {"·"} {ing.stock_qty} {ing.unit} on hand
                      {ing.stock_qty <= ing.reorder_point && (
                        <span className="text-red-600 font-medium ml-1">Low</span>
                      )}
                    </span>
                  )}
                </div>
                {canManage && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditId((p) => (p === ing.id ? null : ing.id))}
                    >
                      {editId === ing.id ? "Close" : "Edit"}
                    </Button>
                  </div>
                )}
              </div>
              {editId === ing.id && (
                <IngredientEditor
                  ing={ing}
                  setIngredients={setIngredients}
                  remove={() => remove(ing.id)}
                  pending={pending}
                  startTransition={startTransition}
                  setErr={setErr}
                  onDone={() => setEditId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IngredientEditor({
  ing,
  setIngredients,
  remove,
  pending,
  startTransition,
  setErr,
  onDone,
}: {
  ing: Ingredient;
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  remove: () => void;
  pending: boolean;
  startTransition: React.TransitionStartFunction;
  setErr: (s: string | null) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(ing.name);
  const [unit, setUnit] = useState(ing.unit);
  const [cost, setCost] = useState(String(ing.cost));
  const [track, setTrack] = useState(ing.track_stock);
  const [reorder, setReorder] = useState(ing.reorder_point ? String(ing.reorder_point) : "");
  const [change, setChange] = useState("");
  const [reason, setReason] = useState("receive");

  function patchLocal(fields: Partial<Ingredient>) {
    setIngredients((prev) =>
      prev
        .map((i) => (i.id === ing.id ? { ...i, ...fields } : i))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  }

  function save() {
    setErr(null);
    startTransition(async () => {
      const res = await updateIngredient(ing.id, {
        name: name.trim(),
        unit,
        cost: parseFloat(cost) || 0,
      });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      patchLocal({ name: name.trim(), unit, cost: parseFloat(cost) || 0 });
      onDone();
    });
  }

  function saveStock() {
    setErr(null);
    startTransition(async () => {
      const res = await setIngredientStock(ing.id, track, parseFloat(reorder) || 0);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      patchLocal({ track_stock: track, reorder_point: parseFloat(reorder) || 0 });
    });
  }

  function adjust() {
    setErr(null);
    const chg = parseFloat(change) || 0;
    if (chg === 0) {
      setErr("Enter a non-zero amount (use a minus sign to remove stock).");
      return;
    }
    startTransition(async () => {
      const res = await adjustIngredientStock(ing.id, chg, reason);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      patchLocal({ stock_qty: res.new_qty });
      setChange("");
    });
  }

  return (
    <div className="mt-3 border-l-2 border-border pl-3 space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 w-44" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Unit</Label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cost / unit</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="h-9 w-28 text-right"
          />
        </div>
        <Button size="sm" onClick={save} disabled={pending}>
          Save
        </Button>
        <Button variant="outline" size="sm" onClick={remove} disabled={pending}>
          Delete
        </Button>
      </div>

      <div className="pt-2 border-t border-border space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTrack((t) => !t)}
            className={
              "px-3 py-1 text-sm rounded-md border transition-colors " +
              (track
                ? "border-foreground bg-accent font-medium"
                : "border-border hover:border-foreground/40")
            }
          >
            {track ? "Stock tracking on" : "Stock tracking off"}
          </button>
          <span className="text-xs text-muted-foreground">
            When on, sales deduct this ingredient via dish recipes.
          </span>
        </div>

        {track && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Low-stock at</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={reorder}
                onChange={(e) => setReorder(e.target.value)}
                placeholder="0"
                className="h-9 w-24 text-right"
              />
            </div>
            <Button size="sm" variant="outline" onClick={saveStock} disabled={pending}>
              Save stock settings
            </Button>
            <div className="space-y-1">
              <Label className="text-xs">Receive / adjust</Label>
              <div className="flex items-end gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={change}
                  onChange={(e) => setChange(e.target.value)}
                  placeholder="e.g. 10 or -2"
                  className="h-9 w-28 text-right"
                />
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
                >
                  <option value="receive">Receive</option>
                  <option value="adjustment">Adjustment</option>
                  <option value="damage">Damage / loss</option>
                  <option value="initial">Initial count</option>
                </select>
                <Button size="sm" onClick={adjust} disabled={pending}>
                  Apply
                </Button>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">
              On hand: {ing.stock_qty} {ing.unit}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Costing + recipes ------------------------------ */

function CostingTable({
  dishes,
  ingredients,
  recipes,
  setRecipes,
  canManage,
  pending,
  startTransition,
  setErr,
  fmt,
  plateCost,
}: {
  dishes: Dish[];
  ingredients: Ingredient[];
  recipes: Record<string, Line[]>;
  setRecipes: React.Dispatch<React.SetStateAction<Record<string, Line[]>>>;
  canManage: boolean;
  pending: boolean;
  startTransition: React.TransitionStartFunction;
  setErr: (s: string | null) => void;
  fmt: (n: number) => string;
  plateCost: (dishId: string) => number;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const activeDishes = dishes.filter((d) => d.is_active);

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-sm font-medium mb-1">Menu costing ({activeDishes.length})</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Per-plate cost and margin for each dish. Build a recipe to see its cost.
      </p>

      {activeDishes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No menu items yet. Add dishes in the Catalog first.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {activeDishes.map((dish) => {
            const lines = recipes[dish.id] || [];
            const hasRecipe = lines.length > 0;
            const cost = plateCost(dish.id);
            const margin = dish.price - cost;
            const foodPct = dish.price > 0 ? cost / dish.price : 0;
            const tone = !hasRecipe
              ? "text-muted-foreground"
              : foodPct <= 0.3
              ? "text-green-600"
              : foodPct <= 0.4
              ? "text-amber-600"
              : "text-red-600";
            return (
              <div key={dish.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{dish.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Price {fmt(dish.price)}
                      {hasRecipe ? (
                        <>
                          {"  ·  Cost "}
                          {fmt(cost)}
                          {"  ·  Margin "}
                          <span className={tone + " font-medium"}>
                            {fmt(margin)} ({Math.round((1 - foodPct) * 100)}%)
                          </span>
                        </>
                      ) : (
                        <span className="ml-1">{"·  No recipe"}</span>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setEditId((p) => (p === dish.id ? null : dish.id))}
                    >
                      {editId === dish.id ? "Done" : hasRecipe ? "Edit recipe" : "Add recipe"}
                    </Button>
                  )}
                </div>

                {editId === dish.id && (
                  <RecipeEditor
                    dish={dish}
                    ingredients={ingredients}
                    initialLines={lines}
                    setRecipes={setRecipes}
                    pending={pending}
                    startTransition={startTransition}
                    setErr={setErr}
                    fmt={fmt}
                    onDone={() => setEditId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RecipeEditor({
  dish,
  ingredients,
  initialLines,
  setRecipes,
  pending,
  startTransition,
  setErr,
  fmt,
  onDone,
}: {
  dish: Dish;
  ingredients: Ingredient[];
  initialLines: Line[];
  setRecipes: React.Dispatch<React.SetStateAction<Record<string, Line[]>>>;
  pending: boolean;
  startTransition: React.TransitionStartFunction;
  setErr: (s: string | null) => void;
  fmt: (n: number) => string;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<Line[]>(initialLines.map((l) => ({ ...l })));
  const ingById = useMemo(() => {
    const m = new Map<string, Ingredient>();
    for (const i of ingredients) m.set(i.id, i);
    return m;
  }, [ingredients]);

  const available = ingredients.filter(
    (i) => i.is_active && !draft.some((l) => l.ingredient_id === i.id)
  );

  const draftCost = draft.reduce((sum, l) => {
    const ing = ingById.get(l.ingredient_id);
    return sum + (ing ? ing.cost * l.quantity : 0);
  }, 0);

  function addLine(ingredientId: string) {
    if (!ingredientId) return;
    setDraft((prev) => [...prev, { ingredient_id: ingredientId, quantity: 1 }]);
  }
  function setQty(id: string, q: number) {
    setDraft((prev) =>
      prev.map((l) => (l.ingredient_id === id ? { ...l, quantity: q } : l))
    );
  }
  function removeLine(id: string) {
    setDraft((prev) => prev.filter((l) => l.ingredient_id !== id));
  }

  function save() {
    setErr(null);
    const clean = draft
      .map((l) => ({ ingredient_id: l.ingredient_id, quantity: Number(l.quantity) || 0 }))
      .filter((l) => l.quantity > 0);
    startTransition(async () => {
      const res = await saveRecipe(dish.id, clean);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setRecipes((prev) => ({ ...prev, [dish.id]: clean }));
      onDone();
    });
  }

  return (
    <div className="mt-3 border-l-2 border-border pl-3 space-y-3">
      {ingredients.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add ingredients above first, then build this recipe.
        </p>
      ) : (
        <>
          {draft.length > 0 && (
            <div className="space-y-2">
              {draft.map((l) => {
                const ing = ingById.get(l.ingredient_id);
                if (!ing) return null;
                return (
                  <div key={l.ingredient_id} className="flex items-center gap-2">
                    <span className="text-sm w-40 truncate">{ing.name}</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={String(l.quantity)}
                      onChange={(e) => setQty(l.ingredient_id, parseFloat(e.target.value) || 0)}
                      className="h-8 w-24 text-right"
                    />
                    <span className="text-xs text-muted-foreground w-28">
                      {ing.unit} {"·"} {fmt(ing.cost * l.quantity)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() => removeLine(l.ingredient_id)}
                    >
                      Remove
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {available.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value=""
                onChange={(e) => addLine(e.target.value)}
                className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
              >
                <option value="">+ Add ingredient…</option>
                {available.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({fmt(i.cost)}/{i.unit})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="text-sm">
              Plate cost <span className="font-medium">{fmt(draftCost)}</span>
              {dish.price > 0 && (
                <span className="text-xs text-muted-foreground ml-2">
                  Margin {fmt(dish.price - draftCost)} (
                  {Math.round((1 - draftCost / dish.price) * 100)}%)
                </span>
              )}
            </div>
            <Button size="sm" onClick={save} disabled={pending}>
              Save recipe
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
