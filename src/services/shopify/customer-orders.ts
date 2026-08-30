import "server-only";

import { z } from "zod";
import type { CustomerOrder, CustomerPurchase } from "@/types";
import { customerAccountGraphqlEndpoint } from "./customer-auth";

const RECENT_ORDERS_QUERY = `
  query BuddyRecentOrders($ordersFirst: Int!, $lineItemsFirst: Int!) {
    customer {
      orders(first: $ordersFirst, reverse: true) {
        nodes {
          id
          name
          processedAt
          cancelledAt
          cancelReason
          financialStatus
          fulfillmentStatus
          totalPrice { amount currencyCode }
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
          id: z.string(),
          name: z.string(),
          processedAt: z.string(),
          cancelledAt: z.string().nullable(),
          cancelReason: z.string().nullable(),
          financialStatus: z.string().nullable(),
          fulfillmentStatus: z.string().nullable(),
          totalPrice: z.object({ amount: z.string(), currencyCode: z.string() }).nullable(),
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

export function parseCustomerOrders(payload: unknown): CustomerOrder[] {
  const result = responseSchema.parse(payload);
  if (result.errors?.length) throw new Error(result.errors[0].message);

  return (result.data?.customer?.orders.nodes || []).map((order) => ({
    id: order.id,
    name: order.name,
    processedAt: order.processedAt,
    cancelledAt: order.cancelledAt,
    cancelReason: order.cancelReason,
    financialStatus: order.financialStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    totalPrice: order.totalPrice ? Number(order.totalPrice.amount) : null,
    currency: order.totalPrice?.currencyCode ?? null,
    lineItems: order.lineItems.nodes.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      title: item.name,
      variantTitle: item.variantTitle,
      productType: item.productType,
      quantity: item.quantity,
      purchasedAt: order.processedAt,
      unitPrice: item.price ? Number(item.price.amount) : null,
      currency: item.price?.currencyCode ?? null,
    })),
  }));
}

export async function fetchRecentCustomerOrders(accessToken: string): Promise<CustomerOrder[]> {
  const graphqlApi = await customerAccountGraphqlEndpoint();
  const response = await fetch(graphqlApi, {
    method: "POST",
    headers: { Authorization: accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: RECENT_ORDERS_QUERY,
      variables: { ordersFirst: 5, lineItemsFirst: 20 },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`Shopify order history query failed (${response.status})`);

  return parseCustomerOrders(await response.json());
}

export async function fetchRecentCustomerPurchases(accessToken: string): Promise<CustomerPurchase[]> {
  const orders = await fetchRecentCustomerOrders(accessToken);
  return orders.flatMap((order) => order.lineItems);
}
