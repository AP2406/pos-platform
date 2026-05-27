"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteCustomer } from "./actions";
import { AddCustomerSheet } from "../add-customer-sheet";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Customer = any;

export function CustomerControls({ customer }: { customer: Customer }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleDelete() {
    if (
      !confirm(
        `Delete customer "${customer.name}"? This cannot be undone.`
      )
    )
      return;
    startTransition(async () => {
      const result = await deleteCustomer(customer.id);
      if ("error" in result) {
        alert(result.error);
      } else {
        router.push("/app/customers");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <AddCustomerSheet
        existingCustomer={customer}
        trigger={
          <Button variant="outline" size="sm">
            Edit
          </Button>
        }
      />
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={handleDelete}
        className="text-red-600 hover:text-red-700"
      >
        Delete
      </Button>
    </div>
  );
}