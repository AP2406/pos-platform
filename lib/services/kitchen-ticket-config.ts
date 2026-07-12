// Phase 2 #8: what prints on a kitchen ticket / station chit. Stored on
// businesses.settings.kitchen_ticket (jsonb). Both chit renderers — the KDS printer
// fallback (kitchen-client ticketHtml) and the per-station chit (qz-print stationChitHtml)
// — read this so a manager controls the chit without a code change. Defaults reproduce
// today's hardcoded output exactly (seat/allergens/note on, prep/fire time off), so an
// unconfigured business is unchanged.
export type KitchenTicketConfig = {
  show_seat: boolean;
  show_allergens: boolean;
  show_note: boolean;
  show_prep_time: boolean;
  show_fire_time: boolean;
  show_station_header: boolean;
};

export const KITCHEN_TICKET_DEFAULTS: KitchenTicketConfig = {
  show_seat: true,
  show_allergens: true,
  show_note: true,
  show_prep_time: false,
  show_fire_time: false,
  show_station_header: true,
};

export function parseKitchenTicketConfig(settings: unknown): KitchenTicketConfig {
  const raw = (settings as { kitchen_ticket?: unknown } | null)?.kitchen_ticket;
  if (!raw || typeof raw !== "object") return { ...KITCHEN_TICKET_DEFAULTS };
  const o = raw as Record<string, unknown>;
  const b = (k: keyof KitchenTicketConfig): boolean =>
    typeof o[k] === "boolean" ? (o[k] as boolean) : KITCHEN_TICKET_DEFAULTS[k];
  return {
    show_seat: b("show_seat"),
    show_allergens: b("show_allergens"),
    show_note: b("show_note"),
    show_prep_time: b("show_prep_time"),
    show_fire_time: b("show_fire_time"),
    show_station_header: b("show_station_header"),
  };
}
