"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireMembership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  dealSchema,
  dealTermsSchema,
  DEAL_STATUSES,
} from "@/lib/validations/deal";
import type { DealStatus } from "@/types/database.types";

function failCreate(message: string): never {
  redirect(`/deals/new?error=${encodeURIComponent(message)}`);
}

export async function createDeal(formData: FormData) {
  const membership = await requireMembership();
  const parsed = dealSchema.safeParse({
    propertyId: formData.get("propertyId"),
    buyerContactId: formData.get("buyerContactId"),
    sellerContactId: formData.get("sellerContactId"),
    dealType: formData.get("dealType") || undefined,
    askingPrice: formData.get("askingPrice"),
    currency: formData.get("currency"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    console.error("Invalid deal input:", parsed.error.issues);
    failCreate(
      parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.",
    );
  }

  const supabase = await createClient();
  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      organization_id: membership.organization.id,
      property_id: parsed.data.propertyId,
      buyer_contact_id: parsed.data.buyerContactId,
      seller_contact_id: parsed.data.sellerContactId,
      deal_type: parsed.data.dealType,
      asking_price: parsed.data.askingPrice ?? null,
      currency: parsed.data.currency ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !deal) {
    console.error("Failed to create deal:", error?.message);
    failCreate("No pudimos crear la operación. Intentá nuevamente.");
  }

  revalidatePath("/deals");
  redirect(`/deals/${deal.id}`);
}

export async function updateDealStatus(dealId: string, status: string) {
  await requireMembership();
  if (!DEAL_STATUSES.includes(status as DealStatus)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("deals")
    .update({ status: status as DealStatus })
    .eq("id", dealId);

  if (error) console.error("Failed to update deal status:", error.message);

  revalidatePath("/deals");
  revalidatePath(`/deals/${dealId}`);
}

export async function updateDealTerms(dealId: string, formData: FormData) {
  await requireMembership();
  const parsed = dealTermsSchema.safeParse({
    offerPrice: formData.get("offerPrice"),
    agreedPrice: formData.get("agreedPrice"),
    currency: formData.get("currency"),
    reservationDate: formData.get("reservationDate"),
    contractDate: formData.get("contractDate"),
    closingDate: formData.get("closingDate"),
    estimatedCommission: formData.get("estimatedCommission"),
    commissionCurrency: formData.get("commissionCurrency"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    console.error("Invalid deal terms input:", parsed.error.issues);
    redirect(
      `/deals/${dealId}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("deals")
    .update({
      offer_price: parsed.data.offerPrice ?? null,
      agreed_price: parsed.data.agreedPrice ?? null,
      currency: parsed.data.currency ?? null,
      reservation_date: parsed.data.reservationDate ?? null,
      contract_date: parsed.data.contractDate ?? null,
      closing_date: parsed.data.closingDate ?? null,
      estimated_commission: parsed.data.estimatedCommission ?? null,
      commission_currency: parsed.data.commissionCurrency ?? null,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", dealId);

  if (error) console.error("Failed to update deal terms:", error.message);

  revalidatePath("/deals");
  revalidatePath(`/deals/${dealId}`);
}
