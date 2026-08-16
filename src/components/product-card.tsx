import Image from "next/image";
import { ArrowUpRight, ShoppingBag } from "lucide-react";
import type { ProductRecommendation } from "@/types";

export function ProductCard({ recommendation }: { recommendation: ProductRecommendation }) {
  const { product, reason } = recommendation;
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
          <button className="button button-dark" type="button" title="Shopify cart connection coming later">
            <ShoppingBag size={15} /> Add to cart
          </button>
        </div>
      </div>
    </article>
  );
}
