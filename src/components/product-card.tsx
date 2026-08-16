"use client";

import Image from "next/image";
import { ArrowUpRight, ShoppingBag } from "lucide-react";
import type { ProductRecommendation } from "@/types";

export function ProductCard({ recommendation }: { recommendation: ProductRecommendation }) {
  const { product, reason } = recommendation;
  const variantId = product.variantId?.split("/").pop();
  let storeOrigin = "https://allgoodpetfood.co.nz";
  try { storeOrigin = new URL(product.url).origin; } catch { /* fallback for local mock products */ }

  return (
    <article className="product-card">
      <div className="product-visual">
        <Image src={product.image} alt={`${product.title} pack`} width={160} height={180} />
        <span className="stock-dot">In stock</span>
      </div>
      <div className="product-content">
        <span className="eyebrow">From {product.retailer}</span>
        <h3>{product.title}</h3>
        <p>{reason}</p>
        <div className="product-price">${product.price.toFixed(2)} <small>{product.currency}</small></div>
        <div className="product-actions">
          <a href={product.url} target="_blank" rel="noreferrer" className="button button-secondary" onClick={(event) => product.url.startsWith("#") && event.preventDefault()}>
            View product <ArrowUpRight size={15} />
          </a>
          {variantId && <a
            className="button button-dark"
            href={`${storeOrigin}/cart/${variantId}:1`}
          >
            <ShoppingBag size={14} /> Add to cart
          </a>}
        </div>
      </div>
    </article>
  );
}
