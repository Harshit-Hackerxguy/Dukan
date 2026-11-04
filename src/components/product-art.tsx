"use client";

import { useId, useState } from "react";
import type { Product } from "@/lib/products";
import { storeConfig } from "@/lib/store-config";

const tones = {
  green: "#285742",
  ochre: "#9b6b28",
  plum: "#705066",
  blue: "#456779",
  cream: "#b28557",
};

export function ProductIllustration({
  kind = "rice",
  tone = "green",
  weight = 50,
  unit = "kg",
  className = "",
  label,
}: {
  kind?: Product["illustration"];
  tone?: Product["tone"];
  weight?: number;
  unit?: string;
  className?: string;
  label?: string;
}) {
  const id = useId().replace(/:/g, "");
  const color = tones[tone];
  return (
    <svg
      className={className}
      viewBox="0 0 280 270"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`${id}-sack`}
          x1="75"
          y1="80"
          x2="235"
          y2="160"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#e5d8b6" />
          <stop offset=".35" stopColor="#f5ecd7" />
          <stop offset=".8" stopColor="#e7dabc" />
          <stop offset="1" stopColor="#c8b996" />
        </linearGradient>
        <linearGradient
          id={`${id}-white`}
          x1="70"
          y1="80"
          x2="230"
          y2="190"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#e1e0d7" />
          <stop offset=".4" stopColor="#fffef5" />
          <stop offset="1" stopColor="#d7d4c9" />
        </linearGradient>
        <radialGradient id={`${id}-potato`} cx=".3" cy=".25" r=".8">
          <stop stopColor="#d8b17c" />
          <stop offset="1" stopColor="#a77642" />
        </radialGradient>
        <pattern
          id={`${id}-weave`}
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 1H4M1 0V4"
            stroke="#8b7855"
            strokeOpacity=".1"
            strokeWidth=".6"
          />
        </pattern>
        <filter
          id={`${id}-shadow`}
          x="-30%"
          y="-20%"
          width="160%"
          height="160%"
        >
          <feDropShadow
            dx="2"
            dy="8"
            stdDeviation="7"
            floodColor="#3d3828"
            floodOpacity=".13"
          />
        </filter>
      </defs>
      <ellipse cx="142" cy="247" rx="79" ry="10" fill="#6d664c" opacity=".09" />
      {kind === "potatoes" ? (
        <g filter={`url(#${id}-shadow)`}>
          <path
            d="M85 80Q143 69 197 83L219 211Q218 244 144 246Q69 243 66 213Z"
            fill="#bb9665"
          />
          {[
            [111, 107, 30, 25, -25],
            [159, 103, 31, 26, 20],
            [190, 133, 26, 31, -20],
            [135, 142, 36, 28, 30],
            [94, 153, 27, 33, -10],
            [176, 179, 37, 29, -30],
            [117, 192, 34, 28, 10],
            [153, 222, 38, 22, -10],
            [201, 215, 21, 23, 20],
            [86, 218, 22, 24, -20],
          ].map(([x, y, rx, ry, rotation], index) => (
            <g key={index} transform={`rotate(${rotation} ${x} ${y})`}>
              <ellipse
                cx={x}
                cy={y}
                rx={rx}
                ry={ry}
                fill={`url(#${id}-potato)`}
              />
              <path
                d={`M${x - 10} ${y - 7}l3 -2m12 17l2 -2m-3 -21l2 -1`}
                stroke="#906334"
                strokeWidth="2"
                strokeLinecap="round"
                opacity=".5"
              />
            </g>
          ))}
          <path
            d="M85 80Q143 69 197 83L219 211Q218 244 144 246Q69 243 66 213Z"
            fill={`url(#${id}-weave)`}
            stroke="#a68a61"
          />
          <path
            d="M85 80L74 218M105 78L99 238M125 77L124 244M145 77L147 245M165 78L172 242M185 80L196 235M72 125Q143 145 207 128M69 153Q143 172 212 156M68 183Q145 201 216 186M67 213Q143 232 218 214"
            stroke="#e0cd9e"
            strokeWidth="2"
            opacity=".55"
          />
          <path d="M87 77Q141 64 196 79L193 93Q141 83 89 92Z" fill="#6d7b3e" />
          <path
            d="M87 78Q140 72 196 80"
            stroke="#e5d8aa"
            strokeWidth="3"
            strokeDasharray="3 3"
          />
          <path
            d="M98 153Q142 145 188 154L193 206Q143 215 92 205Z"
            fill="#f4ead1"
          />
          <text
            x="142"
            y="172"
            textAnchor="middle"
            fontFamily="sans-serif"
            fontSize="10"
            fontWeight="700"
            letterSpacing="2"
            fill="#4c5d31"
          >
            FARM FRESH
          </text>
          <text
            x="142"
            y="191"
            textAnchor="middle"
            fontFamily="sans-serif"
            fontSize="16"
            fontWeight="700"
            fill="#4c5d31"
          >
            POTATOES
          </text>
          <text
            x="142"
            y="204"
            textAnchor="middle"
            fontFamily="sans-serif"
            fontSize="8"
            fill="#706448"
          >
            {weight} {unit} • BULK PACK
          </text>
        </g>
      ) : (
        <g filter={`url(#${id}-shadow)`}>
          <path
            d="M86 42Q141 29 193 43L202 89Q214 159 218 223Q215 244 143 247Q76 246 66 227Q68 158 79 93Z"
            fill={`url(#${id}-${kind === "sugar" ? "white" : "sack"})`}
            stroke={kind === "sugar" ? "#dad7c9" : "#cbbb97"}
          />
          <path
            d="M86 42Q141 29 193 43L202 89Q214 159 218 223Q215 244 143 247Q76 246 66 227Q68 158 79 93Z"
            fill={`url(#${id}-weave)`}
          />
          <path
            d="M87 41Q143 31 193 43L194 53Q142 42 85 52Z"
            fill={kind === "sugar" ? "#e4dfcf" : "#d5c3a0"}
          />
          <path
            d="M88 43Q144 35 192 45"
            stroke="#9f8d69"
            strokeWidth="1.5"
            strokeDasharray="2.5 2"
          />
          <path
            d="M83 66L76 207M193 67L207 207"
            stroke="#fff9e9"
            strokeOpacity=".7"
            strokeWidth="2"
          />
          <path
            d="M73 227Q137 237 211 225"
            stroke="#b5a887"
            strokeWidth="2"
            opacity=".5"
          />
          <path
            d="M79 104Q143 114 204 104L212 212Q147 225 71 211Z"
            fill={color}
          />
          <path
            d="M79 104Q142 115 204 104M72 212Q143 225 212 212"
            stroke="#e6c990"
            strokeWidth="3"
          />
          <text
            x="142"
            y="93"
            textAnchor="middle"
            fontFamily="sans-serif"
            fontSize="17"
            fontWeight="800"
            letterSpacing="1"
            fill={color}
          >
            {storeConfig.name}.
          </text>
          {kind === "sugar" ? (
            <g stroke="#f2e6cc" strokeWidth="1.4">
              <path d="M131 129l12 -6 12 6v13l-12 7-12-7zM131 129l12 7 12-7m-12 7v13" />
              <path d="M124 142l-7 4v9l8 4 8-4v-6m29-12l7 4v9l-8 4-6-3" />
            </g>
          ) : (
            <g fill="#e9d8b0" transform="translate(142 136)">
              <path d="M0 13V-14" stroke="#e9d8b0" />
              <ellipse
                cx="-5"
                cy="-10"
                rx="3"
                ry="6"
                transform="rotate(-35 -5 -10)"
              />
              <ellipse
                cx="5"
                cy="-5"
                rx="3"
                ry="6"
                transform="rotate(35 5 -5)"
              />
              <ellipse
                cx="-5"
                cy="0"
                rx="3"
                ry="6"
                transform="rotate(-35 -5 0)"
              />
              <ellipse cx="5" cy="6" rx="3" ry="6" transform="rotate(35 5 6)" />
            </g>
          )}
          <text
            x="142"
            y="170"
            textAnchor="middle"
            fontFamily="sans-serif"
            fontSize={
              label && label.length > 18 ? "10" : tone === "plum" ? "12" : "15"
            }
            textLength={label && label.length > 16 ? 130 : undefined}
            lengthAdjust="spacingAndGlyphs"
            fontWeight="700"
            letterSpacing="1.2"
            fill="#fff8e8"
          >
            {label
              ? label.toUpperCase()
              : kind === "sugar"
                ? "WHITE SUGAR"
                : tone === "plum"
                  ? "SUPER PREMIUM"
                  : tone === "ochre"
                    ? "PREMIUM RICE"
                    : tone === "blue"
                      ? "EVERYDAY RICE"
                      : "REGULAR RICE"}
          </text>
          <text
            x="142"
            y="186"
            textAnchor="middle"
            fontFamily="sans-serif"
            fontSize="7"
            letterSpacing="2"
            fill="#e6d6b6"
          >
            EVERYDAY GOODNESS
          </text>
          <path d="M121 198H163" stroke="#dfc99d" strokeOpacity=".5" />
          <text
            x="142"
            y="211"
            textAnchor="middle"
            fontFamily="sans-serif"
            fontSize="10"
            fontWeight="600"
            fill="#fff8e8"
          >
            {weight} {unit}
          </text>
          <path
            d="M78 89l4 5m113-5l7 6M81 222l-8 6m127-4l11 4"
            stroke="#ac9b78"
            strokeOpacity=".5"
          />
        </g>
      )}
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
  const [failedUrl, setFailedUrl] = useState("");
  if (product.image && product.image !== failedUrl) {
    // Product images render in the browser with an illustrated fallback.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={`custom-product-image ${className}`}
        src={product.image}
        alt={product.name}
        loading="lazy"
        decoding="async"
        onError={() => setFailedUrl(product.image)}
      />
    );
  }
  return (
    <ProductIllustration
      kind={product.illustration}
      tone={product.tone}
      weight={product.weight}
      unit={product.unit}
      label={product.name}
      className={className}
    />
  );
}

export function HeroArt() {
  return (
    <div
      className="hero-art"
      aria-label="Illustration of rice bags, potatoes, and a bowl of rice"
      role="img"
    >
      <div className="hero-orbit" />
      <svg
        viewBox="0 0 600 380"
        className="hero-botanicals"
        fill="none"
        aria-hidden="true"
      >
        <g stroke="#8c9870" strokeWidth="1.5" opacity=".65">
          <path d="M490 305Q510 170 553 87M513 226q-29-26-24-54 22 11 24 54Zm7-25q33-12 35-40-23 0-35 40Zm10-26q-25-21-18-45 21 8 18 45Zm10-23q28-9 31-34-18 0-31 34Zm-3 3q-14-37 4-61 13 18-4 61Z" />
          <path d="M74 295Q84 240 45 171m32 91q-30-3-34-29 26-3 34 29Zm-3-31q17-22 5-43-19 10-5 43Zm-7-25q-30 5-38-16 25-6 38 16Z" />
        </g>
        <g fill="#e5d2a4" opacity=".8">
          <ellipse
            cx="98"
            cy="327"
            rx="3"
            ry="8"
            transform="rotate(65 98 327)"
          />
          <ellipse
            cx="126"
            cy="341"
            rx="3"
            ry="8"
            transform="rotate(23 126 341)"
          />
          <ellipse
            cx="111"
            cy="352"
            rx="3"
            ry="8"
            transform="rotate(85 111 352)"
          />
          <ellipse
            cx="452"
            cy="335"
            rx="3"
            ry="8"
            transform="rotate(70 452 335)"
          />
        </g>
      </svg>
      <ProductIllustration kind="sugar" tone="cream" className="hero-sugar" />
      <ProductIllustration tone="green" className="hero-rice" />
      <ProductIllustration kind="potatoes" className="hero-potatoes" />
      <svg
        className="hero-bowl"
        viewBox="0 0 180 115"
        fill="none"
        aria-hidden="true"
      >
        <ellipse cx="90" cy="101" rx="70" ry="8" fill="#796d4d" opacity=".12" />
        <path d="M17 42Q20 101 90 105Q159 101 163 42Z" fill="#a8794b" />
        <path
          d="M22 61Q91 89 158 61M31 79Q90 104 150 79"
          stroke="#b99167"
          strokeWidth="2"
        />
        <ellipse cx="90" cy="43" rx="73" ry="29" fill="#d4b184" />
        <ellipse cx="90" cy="40" rx="64" ry="23" fill="#f0e7cf" />
        {Array.from({ length: 52 }, (_, i) => {
          const x = 36 + ((i * 31) % 107);
          const y = 29 + ((i * 13) % 26);
          return (
            <ellipse
              key={i}
              cx={x}
              cy={y}
              rx="1.5"
              ry="5"
              fill={i % 3 === 0 ? "#d9cbaa" : "#fffcf0"}
              transform={`rotate(${i * 39} ${x} ${y})`}
            />
          );
        })}
      </svg>
      <div className="hero-stamp">
        <span>EVERYDAY</span>
        <strong>goodness</strong>
        <span>BY THE BAG</span>
        <i>✦</i>
      </div>
    </div>
  );
}
