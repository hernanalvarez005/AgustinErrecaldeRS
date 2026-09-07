"use server";

import { requireMembership } from "@/lib/auth/session";
import { listContacts } from "@/lib/data/contacts";
import { listProperties } from "@/lib/data/properties";

/**
 * Global search (⌘K command palette, Bloque UI-2). Reuses the same
 * `listContacts`/`listProperties` data-layer functions the /contacts and
 * /properties list pages already use for their own `?search=` filter —
 * this adds no new query logic, just a client-callable entry point (those
 * functions are `server-only` and can't be imported directly from a Client
 * Component) and caps results to a handful per entity for a dropdown.
 */
export async function globalSearch(query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { contacts: [], properties: [] };
  }

  const membership = await requireMembership();
  const organizationId = membership.organization.id;

  const [contacts, properties] = await Promise.all([
    listContacts({ organizationId, search: trimmed }),
    listProperties({ organizationId, search: trimmed }),
  ]);

  return {
    contacts: contacts.slice(0, 5),
    properties: properties.slice(0, 5),
  };
}
