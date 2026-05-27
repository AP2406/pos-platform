import { SquareClient, SquareEnvironment } from "square";
import { randomUUID } from "crypto";

export function isSquareConfigured(): boolean {
  return !!(
    process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID
  );
}

function getClient(): SquareClient | null {
  if (!process.env.SQUARE_ACCESS_TOKEN) return null;
  const env =
    process.env.SQUARE_ENVIRONMENT === "production"
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox;
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN,
    environment: env,
  });
}

export type SquareInvoiceResult = {
  squareCustomerId: string;
  orderId: string;
  invoiceId: string;
  invoiceStatus: string;
  invoiceUrl: string | null;
};

export async function createDraftSquareInvoice(input: {
  customer: {
    square_customer_id: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  trip: {
    pickup_address: string;
    dropoff_address: string;
    scheduled_at: string;
    price_total: number;
  };
  currency: string;
}): Promise<{ ok: true; data: SquareInvoiceResult } | { error: string }> {
  const client = getClient();
  if (!client) return { error: "Square not configured." };

  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!locationId) return { error: "SQUARE_LOCATION_ID not set." };

  try {
    // 1. Find or create Square customer
    let squareCustomerId = input.customer.square_customer_id;

    if (!squareCustomerId) {
      const nameParts = (input.customer.name ?? "Customer").trim().split(/\s+/);
      const givenName = nameParts[0] || "Customer";
      const familyName = nameParts.slice(1).join(" ") || undefined;

      const createCustResp = await client.customers.create({
        idempotencyKey: randomUUID(),
        givenName,
        familyName,
        emailAddress: input.customer.email ?? undefined,
        phoneNumber: input.customer.phone ?? undefined,
      });

      squareCustomerId = createCustResp.customer?.id ?? null;
      if (!squareCustomerId) {
        return { error: "Failed to create Square customer." };
      }
    }

    // 2. Create Square Order
    const cents = BigInt(Math.round(input.trip.price_total * 100));
    const tripDate = new Date(input.trip.scheduled_at).toLocaleDateString(
      "en-CA",
      { year: "numeric", month: "short", day: "numeric" }
    );

    const createOrderResp = await client.orders.create({
      idempotencyKey: randomUUID(),
      order: {
        locationId,
        customerId: squareCustomerId,
        lineItems: [
          {
            name: `Trip on ${tripDate}`,
            note: `${input.trip.pickup_address} -> ${input.trip.dropoff_address}`,
            quantity: "1",
            basePriceMoney: {
              amount: cents,
              currency: input.currency as "CAD" | "USD",
            },
          },
        ],
      },
    });

    const orderId = createOrderResp.order?.id;
    if (!orderId) return { error: "Failed to create Square order." };

    // 3. Create draft Invoice (NOT published)
    const dueDate = new Date(input.trip.scheduled_at)
      .toISOString()
      .split("T")[0];

    const createInvoiceResp = await client.invoices.create({
      idempotencyKey: randomUUID(),
      invoice: {
        locationId,
        orderId,
primaryRecipient: { customerId: squareCustomerId },
        acceptedPaymentMethods: {
          card: true,
          squareGiftCard: false,
          bankAccount: false,
          buyNowPayLater: false,
          cashAppPay: false,
        },
        paymentRequests: [
          {
            requestType: "BALANCE",
            dueDate,
          },
        ],
        deliveryMethod: "EMAIL",
        title: `Trip on ${tripDate}`,
        description: `${input.trip.pickup_address} -> ${input.trip.dropoff_address}`,
      },
    });

    const invoice = createInvoiceResp.invoice;
    if (!invoice?.id) return { error: "Failed to create Square invoice." };

    return {
      ok: true,
      data: {
        squareCustomerId,
        orderId,
        invoiceId: invoice.id,
        invoiceStatus: invoice.status ?? "DRAFT",
        invoiceUrl: invoice.publicUrl ?? null,
      },
    };
  } catch (error) {
    console.error("createDraftSquareInvoice error:", error);
    const msg =
      error instanceof Error ? error.message : "Square API error";
    return { error: msg };
  }
}

export function getSquareDashboardUrl(invoiceId: string): string {
  const isProd = process.env.SQUARE_ENVIRONMENT === "production";
  const base = isProd
    ? "https://app.squareup.com"
    : "https://app.squareupsandbox.com";
  return `${base}/dashboard/invoices/${invoiceId}`;
}