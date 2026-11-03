"use client";
import { useState, useId } from "react";
import type { Illustration, Product } from "@/lib/products";

export function ProductIllustration({
  kind = "rice",
  className = "",
  weight = 50,
}: {
  kind?: Illustration;
  tone?: string;
  label?: string;
  weight?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const potato = kind === "potatoes";
  return (
    <svg
      viewBox="0 0 300 260"
      className={className}
      role="img"
      aria-label={`${potato ? "Potato sack" : kind === "sugar" ? "Sugar sack" : "Rice sack"} illustration`}
    >
      <defs>
        <linearGradient id={`sack-${uid}`} x1="0" x2="1">
          <stop stopColor={potato ? "#c3a778" : "#e2e2d6"} />
          <stop offset=".4" stopColor={potato ? "#e3c797" : "#fafaf4"} />
          <stop offset="1" stopColor={potato ? "#bfa16d" : "#d9dacc"} />
        </linearGradient>
        <pattern
          id={`weave-${uid}`}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 0H5M0 0V5"
            stroke="#81775e"
            strokeWidth=".45"
            opacity=".22"
          />
        </pattern>
      </defs>
      <ellipse cx="151" cy="230" rx="81" ry="10" fill="#243d2d" opacity=".09" />
      <path
        d="M94 60Q150 45 206 60L198 84Q188 119 214 209Q218 229 196 230H102Q80 230 86 210Q112 126 102 84Z"
        fill={`url(#sack-${uid})`}
        stroke="#b8b9a6"
        strokeWidth="1.5"
      />
      <path
        d="M94 60Q150 45 206 60L198 84Q188 119 214 209Q218 229 196 230H102Q80 230 86 210Q112 126 102 84Z"
        fill={`url(#weave-${uid})`}
      />
      {potato ? (
        <g fill="#ac7c45" stroke="#966c3f">
          {[
            [119, 101],
            [147, 91],
            [175, 103],
            [133, 125],
            [168, 130],
            [110, 151],
            [149, 154],
            [184, 155],
          ].map(([x, y], i) => (
            <ellipse
              key={i}
              cx={x}
              cy={y}
              rx="17"
              ry="12"
              transform={`rotate(${i * 19} ${x} ${y})`}
            />
          ))}
        </g>
      ) : (
        <g fill="#e9e2c9">
          {Array.from({ length: 12 }, (_, i) => (
            <ellipse
              key={i}
              cx={116 + i * 6}
              cy={59 + (i % 3) * 4}
              rx="4"
              ry="2"
              transform={`rotate(${i * 20} ${116 + i * 6} 60)`}
            />
          ))}
        </g>
      )}
      <path
        d="M91 61Q151 79 209 61L201 85Q151 96 100 83Z"
        fill={potato ? "#dbc393" : "#f5f4ea"}
        stroke="#b8b9a6"
        strokeWidth="1.5"
      />
      <path
        d="M105 99Q118 155 96 214M196 98Q183 156 204 215"
        stroke="#8e9179"
        opacity=".2"
        fill="none"
        strokeWidth="2"
      />
      <text
        x="150"
        y="188"
        fontSize="21"
        fontFamily="sans-serif"
        textAnchor="middle"
        fontWeight="700"
        fill="#596352"
      >
        {weight} KG
      </text>
      <path
        d="M100 220Q150 225 202 220"
        stroke="#8e9179"
        opacity=".35"
        fill="none"
      />
    </svg>
  );
}
export function ProductImage({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  const [failed, setFailed] = useState("");
  return product.image && failed !== product.image ? (
    // Product photos are administrator-selected HTTPS or validated raster uploads.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={product.image}
      alt={product.name}
      className={className}
      onError={() => setFailed(product.image)}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  ) : (
    <ProductIllustration
      kind={product.illustration}
      weight={product.weight}
      className={className}
    />
  );
}
