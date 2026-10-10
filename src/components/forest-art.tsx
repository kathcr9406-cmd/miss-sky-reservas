export function ForestArt() {
  return (
    <svg
      viewBox="0 0 680 540"
      className="forest-art"
      role="img"
      aria-labelledby="forest-title"
    >
      <title id="forest-title">
        Ilustración de una aventura de canopy entre montañas y árboles
      </title>
      <defs>
        <linearGradient id="sky" x2="0.8" y2="1">
          <stop stopColor="#d4dfc2" />
          <stop offset="1" stopColor="#96bda0" />
        </linearGradient>
        <linearGradient id="front" x2="0" y2="1">
          <stop stopColor="#174b3c" />
          <stop offset="1" stopColor="#092e27" />
        </linearGradient>
        <pattern id="grain" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".5" fill="#fff" opacity=".13" />
        </pattern>
      </defs>
      <rect width="680" height="540" fill="url(#sky)" />
      <circle cx="495" cy="112" r="55" fill="#f0dc93" />
      <path
        d="M0 288 Q90 196 154 225 T304 182 T453 203 T680 158 V540H0Z"
        fill="#84a78e"
      />
      <path
        d="M0 310 Q110 259 185 286 T365 220 T545 275 T680 253 V540H0Z"
        fill="#598976"
      />
      <path
        d="M0 366 Q130 303 239 331 T423 296 T680 348 V540H0Z"
        fill="#386c57"
      />
      <path d="M0 431 Q161 310 326 410 T680 347 V540H0Z" fill="#235640" />
      <path d="M0 511 Q180 409 371 472 T680 432 V540H0Z" fill="url(#front)" />
      <path
        d="M-20 57 Q282 168 710 124"
        stroke="#234438"
        strokeWidth="3"
        fill="none"
      />
      <path
        d="M-20 70 Q282 181 710 137"
        stroke="#234438"
        strokeWidth="1.2"
        fill="none"
        opacity=".5"
      />
      <g transform="translate(353 140) rotate(-12)">
        <circle cx="0" cy="0" r="5" fill="#1d3d30" />
        <path d="M0 5V30" stroke="#203d31" strokeWidth="3" />
        <circle cx="8" cy="47" r="10" fill="#ebbe70" />
        <path
          d="M-1 39L-11 18M1 40L4 18"
          stroke="#173f30"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M5 60L5 84"
          stroke="#edc975"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          d="M5 88L-11 105L-35 106M6 88L19 106L39 112"
          stroke="#183f32"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M-5 83L17 84" stroke="#203e31" strokeWidth="4" />
        <path d="M0 5L17 84" stroke="#3b5b43" strokeWidth="2" />
      </g>
      <g fill="#123d2e">
        <path d="M-18 550L34 140L52 138L79 550Z" />
        <path d="M38 175L-8 117L-58 71L-36 52L23 95L48 146Z" />
        <ellipse cx="38" cy="92" rx="100" ry="58" />
        <ellipse cx="-5" cy="37" rx="120" ry="69" />
        <ellipse cx="110" cy="42" rx="93" ry="56" />
        <path d="M623 550L651 219L664 219L680 550Z" />
        <ellipse cx="680" cy="215" rx="73" ry="87" />
        <ellipse cx="657" cy="171" rx="51" ry="43" />
      </g>
      <g fill="#0a3026">
        <path d="M13 540Q51 454 87 431Q51 485 48 540Z" />
        <path d="M47 540Q40 464 15 440Q66 467 73 540Z" />
        <path d="M505 540Q552 424 589 405Q548 471 540 540Z" />
        <path d="M533 540Q502 448 468 441Q515 465 551 540Z" />
        <path d="M554 540Q604 445 645 452Q597 479 584 540Z" />
      </g>
      <path
        d="M562 65q9-10 18 0q9-10 18 0M452 47q7-8 14 0q7-8 14 0"
        stroke="#537760"
        fill="none"
        strokeWidth="2"
      />
      <rect width="680" height="540" fill="url(#grain)" />
    </svg>
  );
}
