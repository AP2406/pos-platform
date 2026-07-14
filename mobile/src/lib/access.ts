import type { Surface, DeviceHome, NativeRoleAccess, NativeAccessConfig } from "@surge/api-contracts";

export type { Surface, DeviceHome, NativeRoleAccess, NativeAccessConfig };

export const ALL_SURFACES: Surface[] = ["floor", "register", "kds", "sales"];

// Route per surface.
export const SURFACE_ROUTE: Record<Surface, "/floor" | "/register" | "/kds" | "/history"> = {
  floor: "/floor",
  register: "/register",
  kds: "/kds",
  sales: "/history",
};

// Sensible defaults per role (works before an owner configures anything). Handles
// both the seeded role keys and the legacy enum values returned by the PIN gate.
export function defaultRoleAccess(roleKey: string): NativeRoleAccess {
  switch ((roleKey || "").toLowerCase().replace(/[\s-]/g, "_")) {
    case "owner":
    case "manager":
    case "shift_lead":
    case "shiftlead":
      return { surfaces: ["floor", "register", "kds", "sales"], home: "floor" };
    case "server":
    case "staff":
    case "waiter":
      // Servers can glance at the kitchen (read-only — see canBumpKds).
      return { surfaces: ["floor", "register", "kds"], home: "floor" };
    case "host":
    case "trainee":
      return { surfaces: ["floor"], home: "floor" };
    case "bookkeeper":
      return { surfaces: ["sales"], home: "sales" };
    case "kitchen":
    case "cook":
    case "line_cook":
    case "kds":
      return { surfaces: ["kds"], home: "kds" };
    default:
      return { surfaces: ["floor", "register"], home: "floor" };
  }
}

// Who can BUMP on the KDS (fired -> ready). A Kitchen-Display device lets anyone
// bump; otherwise kitchen/manager/owner only. Servers/hosts get a READ-ONLY glance.
export function canBumpKds(roleKey: string, deviceHome: DeviceHome | null): boolean {
  if (deviceHome === "kds") return true;
  switch ((roleKey || "").toLowerCase().replace(/[\s-]/g, "_")) {
    case "owner":
    case "manager":
    case "shift_lead":
    case "shiftlead":
    case "kitchen":
    case "cook":
    case "line_cook":
    case "kds":
      return true;
    default:
      return false;
  }
}

// Effective access: a Kitchen-Display DEVICE forces KDS for anyone; otherwise the
// role default, overridden by the owner's settings.native_access for that role.
export function resolveNativeAccess(roleKey: string, config: NativeAccessConfig | null, deviceHome: DeviceHome | null): NativeRoleAccess {
  if (deviceHome === "kds") return { surfaces: ["kds"], home: "kds" };
  const base = defaultRoleAccess(roleKey);
  const key = (roleKey || "").toLowerCase().replace(/[\s-]/g, "_");
  const override = config?.[key];
  const surfaces = override?.surfaces?.length ? override.surfaces : base.surfaces;
  let home = override?.home ?? base.home;
  if (!surfaces.includes(home)) home = surfaces[0] ?? "floor";
  return { surfaces, home };
}
