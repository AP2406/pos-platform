"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { createVehicle } from "./actions";

export function AddVehicleSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [plate, setPlate] = useState("");
  const [capacity, setCapacity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName("");
    setVehicleType("");
    setPlate("");
    setCapacity("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createVehicle({
        name,
        vehicle_type: vehicleType,
        plate,
        capacity: capacity ? parseInt(capacity, 10) : null,
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        reset();
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <SheetTrigger asChild>
        <Button>+ Add vehicle</Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <SheetHeader>
            <SheetTitle>Add vehicle</SheetTitle>
            <SheetDescription>
              Add a car you drive. You can mark it inactive later if you sell
              it.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 px-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Black Suburban"
                autoFocus
              />
              <p className="text-xs text-slate-500">
                Whatever name you&apos;ll recognize it by.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Input
                id="type"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                placeholder="SUV"
              />
              <p className="text-xs text-slate-500">
                e.g. Sedan, SUV, Sprinter Van, Stretch Limousine
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plate">Plate number</Label>
              <Input
                id="plate"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder="ABCD 123"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">Passenger capacity</Label>
              <Input
                id="capacity"
                type="number"
                min="1"
                max="60"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="6"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <SheetFooter className="gap-2 flex-row">
            <SheetClose asChild>
              <Button type="button" variant="outline" className="flex-1">
                Cancel
              </Button>
            </SheetClose>
            <Button
              type="submit"
              className="flex-1"
              disabled={isPending || !name.trim()}
            >
              {isPending ? "Adding..." : "Add vehicle"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}