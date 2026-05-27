"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deletePartner } from "./actions";
import { AddPartnerSheet } from "../add-partner-sheet";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Partner = any;

export function PartnerControls({ partner }: { partner: Partner }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleDelete() {
    if (
      !confirm(
        `Delete partner "${partner.name}"? This cannot be undone.`
      )
    )
      return;
    startTransition(async () => {
      const result = await deletePartner(partner.id);
      if ("error" in result) {
        alert(result.error);
      } else {
        router.push("/app/partners");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <AddPartnerSheet
        existingPartner={partner}
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