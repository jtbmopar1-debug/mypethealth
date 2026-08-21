"use client";

import Image from "next/image";
import { ArrowUpRight, ShoppingBag } from "lucide-react";
import { useState } from "react";
import type { ProductRecommendation } from "@/types";

export function ProductCard({ recommendation }: { recommendation: ProductRecommendation }) {
  const { product, reason } = recommendation;
  const [cartStatus, setCartStatus] = useState("");
  const variantId = product.variantId?.split("/").pop();
  let storeOrigin = "https://allgoodpetfood.co.nz";
  try { storeOrigin = new URL(product.url).origin; } catch { /* fallback for local mock products */ }

  function addToStoreCart() {
    if (!variantId) return;
    setCartStatus("Adding to your All Good Petfood cart…");
    const addUrl = `${storeOrigin}/cart/add?id=${encodeURIComponent(variantId)}&quantity=1`;
    const cartWindow = window.open(addUrl, "buddy-shopify-cart", "popup,width=520,height=680");
    if (!cartWindow) {
      setCartStatus("Your browser blocked the cart update. Please allow pop-ups and try again.");
      return;
    }
    window.setTimeout(() => {
      cartWindow.close();
      setCartStatus("Added to your All Good Petfood cart.");
    }, 2500);
  }

  return (
    <article className="product-card">
      <div className="product-visual">
        <Image src={product.image} alt={`${product.title} pack`} width={160} height={180} />
        <span className="stock-dot">{product.availability === "in_stock" ? "In stock" : "Out of stock"}</span>
      </div>
      <div className="product-content">
        <span className="eyebrow">From {product.retailer}</span>
        <h3>{product.title}</h3>
        {reason && <p>{reason}</p>}
        {recommendation.priceNote && <p className="product-price-note">{recommendation.priceNote}</p>}
        <div className="product-price">${product.price.toFixed(2)} <small>{product.currency}</small></div>
        <div className="product-actions">
          <a href={product.url} target="_blank" rel="noreferrer" className="button button-secondary" onClick={(event) => product.url.startsWith("#") && event.preventDefault()}>
            View product <ArrowUpRight size={15} />
          </a>
          {variantId && product.availability === "in_stock" && <button type="button" className="button button-dark" onClick={addToStoreCart}>
            <ShoppingBag size={14} /> Add to cart
          </button>}
        </div>
        {cartStatus && <small className="cart-status" role="status">
          {cartStatus}
          {cartStatus.startsWith("Added") && <> · <a href={`${storeOrigin}/cart`} target="_blank" rel="noreferrer">View cart</a></>}
        </small>}
      </div>
    </article>
  );
}
