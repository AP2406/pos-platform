// lib/services/finix-onboarding.ts
// Seller (sub-merchant) onboarding for the Surge platform.
// Server-only. Builds on the shared finix request helper in ./finix.

import { finix } from "./finix";

export type FinixBusinessType =
  | "INDIVIDUAL_SOLE_PROPRIETORSHIP"
  | "CORPORATION"
  | "LIMITED_LIABILITY_COMPANY"
  | "PARTNERSHIP"
  | "GENERAL_PARTNERSHIP"
  | "LIMITED_PARTNERSHIP"
  | "ASSOCIATION_ESTATE_TRUST"
  | "TAX_EXEMPT_ORGANIZATION";

export type FinixAddress = {
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
};

export type FinixDateParts = { day: number; month: number; year: number };

export type CreateMerchantIdentityInput = {
  businessName: string;
  doingBusinessAs?: string;
  businessType: FinixBusinessType;
  businessPhone: string;
  businessTaxId?: string;
  businessAddress: FinixAddress;
  businessDescription: string;
  url?: string;
  incorporationDate?: FinixDateParts;
  ownershipType?: "PRIVATE" | "PUBLIC";
  mcc?: string;
  defaultStatementDescriptor?: string;
  annualCardVolumeCents?: number;
  maxTransactionAmountCents?: number;
  ownerFirstName: string;
  ownerLastName: string;
  ownerTitle?: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerDob?: FinixDateParts;
  ownerTaxId?: string;
  ownerPersonalAddress: FinixAddress;
  principalPercentageOwnership?: number;
  tags?: Record<string, string>;
};

export type FinixMerchantIdentity = {
  id: string;
  entity: Record<string, unknown>;
  created_at: string;
};

function buildEntity(input: CreateMerchantIdentityInput): Record<string, unknown> {
  const entity: Record<string, unknown> = {
    business_name: input.businessName,
    business_type: input.businessType,
    business_phone: input.businessPhone,
    business_address: input.businessAddress,
    business_description: input.businessDescription,
    first_name: input.ownerFirstName,
    last_name: input.ownerLastName,
    email: input.ownerEmail,
    phone: input.ownerPhone,
    personal_address: input.ownerPersonalAddress,
  };

  if (input.doingBusinessAs) entity.doing_business_as = input.doingBusinessAs;
  if (input.businessTaxId) entity.business_tax_id = input.businessTaxId;
  if (input.url) entity.url = input.url;
  if (input.incorporationDate) entity.incorporation_date = input.incorporationDate;
  if (input.ownershipType) entity.ownership_type = input.ownershipType;
  if (input.mcc) entity.mcc = input.mcc;
  if (input.defaultStatementDescriptor) {
    entity.default_statement_descriptor = input.defaultStatementDescriptor;
  }
  if (typeof input.annualCardVolumeCents === "number") {
    entity.annual_card_volume = input.annualCardVolumeCents;
  }
  if (typeof input.maxTransactionAmountCents === "number") {
    entity.max_transaction_amount = input.maxTransactionAmountCents;
  }
  if (input.ownerTitle) entity.title = input.ownerTitle;
  if (input.ownerDob) entity.dob = input.ownerDob;
  if (input.ownerTaxId) entity.tax_id = input.ownerTaxId;
  if (typeof input.principalPercentageOwnership === "number") {
    entity.principal_percentage_ownership = input.principalPercentageOwnership;
  }

  return entity;
}

export async function createMerchantIdentity(input: CreateMerchantIdentityInput) {
  return finix.post<FinixMerchantIdentity>("/identities", {
    entity: buildEntity(input),
    identity_roles: ["SELLER"],
    tags: input.tags,
  });
}

export type MerchantBankAccountFields = {
  name: string;
  accountNumber: string;
  accountType: string;
  institutionNumber: string;
  transitNumber: string;
  country: string;
  currency: string;
};

export type FinixBankAccount = {
  id: string;
  identity: string;
  instrument_type: string;
  masked_account_number?: string;
  created_at: string;
};

export async function createMerchantBankAccount(
  identityId: string,
  fields: MerchantBankAccountFields
) {
  return finix.post<FinixBankAccount>("/payment_instruments", {
    type: "BANK_ACCOUNT",
    identity: identityId,
    name: fields.name,
    account_number: fields.accountNumber,
    account_type: fields.accountType,
    institution_number: fields.institutionNumber,
    transit_number: fields.transitNumber,
    country: fields.country,
    currency: fields.currency,
  });
}

export type FinixMerchant = {
  id: string;
  identity: string;
  application: string;
  onboarding_state?: string;
  processor: string;
  created_at: string;
};

export async function provisionMerchant(
  identityId: string,
  tags?: Record<string, string>
) {
  return finix.post<FinixMerchant>("/identities/" + identityId + "/merchants", {
    processor: "DUMMY_V1",
    tags: tags,
  });
}

export async function getMerchant(merchantId: string) {
  return finix.get<FinixMerchant>("/merchants/" + merchantId);
}