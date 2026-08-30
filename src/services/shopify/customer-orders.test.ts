import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseCustomerOrders } from "./customer-orders";

describe("parseCustomerOrders", () => {
  it("keeps cancelled orders and their line items in customer history", () => {
    const orders = parseCustomerOrders({
      data: {
        customer: {
          orders: {
            nodes: [{
              id: "gid://shopify/Order/34472",
              name: "WO-34472",
              processedAt: "2026-08-29T23:00:00Z",
              cancelledAt: "2026-08-30T00:00:00Z",
              cancelReason: "CUSTOMER",
              financialStatus: "VOIDED",
              fulfillmentStatus: "UNFULFILLED",
              totalPrice: { amount: "76.49", currencyCode: "NZD" },
              lineItems: {
                nodes: [{
                  name: "Black Hawk Puppy Ocean Fish",
                  productId: "gid://shopify/Product/1",
                  variantId: "gid://shopify/ProductVariant/2",
                  variantTitle: "10kg",
                  productType: "Dog Food",
                  quantity: 1,
                  price: { amount: "76.49", currencyCode: "NZD" },
                }],
              },
            }],
          },
        },
      },
    });

    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      name: "WO-34472",
      cancelledAt: "2026-08-30T00:00:00Z",
      cancelReason: "CUSTOMER",
      totalPrice: 76.49,
    });
    expect(orders[0].lineItems[0]).toMatchObject({
      title: "Black Hawk Puppy Ocean Fish",
      quantity: 1,
    });
  });
});
