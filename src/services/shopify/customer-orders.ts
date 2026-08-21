import "server-only";

import { z } from "zod";
import type { CustomerPurchase } from "@/types";
import { customerAccountGraphqlEndpoint } from "./customer-auth";

const RECENT_PURCHASES_QUERY = `
  query BuddyRecentPurchases($ordersFirst: Int!, $lineItemsFirst: Int!) {
    customer {
      orders(first: $ordersFirst, reverse: true) {
        nodes {
          processedAt
          cancelledAt
          lineItems(first: $lineItemsFirst) {
            nodes {
              name
              productId
              variantId
              variantTitle
              productType
              quantity
              price { amount currencyCode }
            }
          }
        }
      }
    }
  }
`;

const responseSchema = z.object({
  data: z.object({
    customer: z.object({
      orders: z.object({
        nodes: z.array(z.object({
          processedAt: z.string(),
          cancelledAt: z.string().nullable(),
          lineItems: z.object({
            nodes: z.array(z.object({
              name: z.string(),
              productId: z.string().nullable(),
              variantId: z.string().nullable(),
              variantTitle: z.string().nullable(),
              productType: z.string().nullable(),
              quantity: z.number().int().nonnegative(),
              price: z.object({ amount: z.string(), currencyCode: z.string() }).nullable(),
            })),
          }),
        })),
      }),
    }).nullable(),
  }).optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

export async function fetchRecentCustomerPurchases(accessToken: string): Promise<CustomerPurchase[]> {
  const graphqlApi = await customerAccountGraphqlEndpoint();
  const response = await fetch(graphqlApi, {
    method: "POST",
    headers: { Authorization: accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: RECENT_PURCHASES_QUERY,
      variables: { ordersFirst: 5, lineItemsFirst: 20 },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`Shopify order history query failed (${response.status})`);

  const result = responseSchema.parse(await response.json());
  if (result.errors?.length) throw new Error(result.errors[0].message);

  return (result.data?.customer?.orders.nodes || []).filter((order) => !order.cancelledAt).flatMap((order) => order.lineItems.nodes.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    title: item.name,
    variantTitle: item.variantTitle,
    productType: item.productType,
    quantity: item.quantity,
    purchasedAt: order.processedAt,
    unitPrice: item.price ? Number(item.price.amount) : null,
    currency: item.price?.currencyCode ?? null,
  })));
}
