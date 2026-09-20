/* ── mascots ────────────────────────────────────────────────────────────────
   Twelve line-drawn faces, one stroke weight, no fills. A player without a
   photo gets one picked from their id, so the same person always draws the
   same face across the stage, their card, and the final table. */

const HASH_SEED = 5381;

function hash(seed: string) {
  let value = HASH_SEED;
  for (let index = 0; index < seed.length; index += 1) value = ((value << 5) + value + seed.charCodeAt(index)) >>> 0;
  return value;
}

/* shared features ------------------------------------------------------- */

const earsLeft = <path d="M25 51c-4.5 0-7 3-7 6.5s2.5 6.5 7 6.5" />;
const earsRight = <path d="M75 51c4.5 0 7 3 7 6.5s-2.5 6.5-7 6.5" />;
const ears = <>{earsLeft}{earsRight}</>;

const dot = (cx: number, cy: number) => <circle cx={cx} cy={cy} r="2.1" fill="currentColor" stroke="none" />;
const eyesDots = <>{dot(40, 53)}{dot(60, 53)}</>;
const eyesSquint = <><path d="M35 53c3-2.5 7-2.5 10 0" /><path d="M55 53c3-2.5 7-2.5 10 0" /></>;
const eyesWide = <><circle cx="40" cy="53" r="4.2" />{dot(40, 53)}<circle cx="60" cy="53" r="4.2" />{dot(60, 53)}</>;

const browsFlat = <><path d="M34 44h11" /><path d="M55 44h11" /></>;
const browsRaised = <><path d="M34 45c3-3 8-3.5 11-1.5" /><path d="M55 43.5c3-2 8-1.5 11 1.5" /></>;

const nose = <path d="M50 55v6h-3.5" />;

const smile = <path d="M41 67c4.5 4.5 13.5 4.5 18 0" />;
const grin = <path d="M40 65c5 6 15 6 20 0z" />;
const straight = <path d="M42 68h16" />;
const smirk = <path d="M42 67c5 3.5 11 2.5 15-1" />;

/* the twelve ------------------------------------------------------------ */

const round = <circle cx="50" cy="55" r="26" />;
const oval = <ellipse cx="50" cy="55" rx="23" ry="27" />;
const square = <path d="M27 46a23 20 0 0146 0v14a23 23 0 01-46 0z" />;
const long = <path d="M28 48a22 24 0 0144 0v12c0 15-9 24-22 24s-22-9-22-24z" />;

const MASCOTS: Array<() => React.ReactNode> = [
  // 01 · baseball cap
  () => <>{round}{ears}{eyesDots}{nose}{smile}
    <path d="M25 47a25 25 0 0150 0" />
    <path d="M75 47c9 .5 15 3.5 17 7H50" />
  </>,
  // 02 · cricket helmet with grille
  () => <>{round}{ears}{eyesSquint}{nose}{straight}
    <path d="M24 50a26 26 0 0152 0" />
    <path d="M24 50v7" /><path d="M76 50v7" />
    <path d="M60 62h17" /><path d="M60 70h15" /><path d="M63 56h14" />
  </>,
  // 03 · full beard
  () => <>{square}{ears}{eyesDots}{browsFlat}{nose}{smirk}
    <path d="M28 58c1 19 11 27 22 27s21-8 22-27" />
    <path d="M31 40c6-5 32-5 38 0" />
  </>,
  // 04 · handlebar moustache
  () => <>{oval}{ears}{eyesDots}{browsRaised}{nose}
    <path d="M50 64c-4 0-6 1.5-8.5 3.5-3 2.5-6 1-6-1.5" />
    <path d="M50 64c4 0 6 1.5 8.5 3.5 3 2.5 6 1 6-1.5" />
    <path d="M44 73h12" />
  </>,
  // 05 · headband and tufts
  () => <>{round}{ears}{eyesSquint}{nose}{smile}
    <path d="M26 46h48" /><path d="M26 41h48" />
    <path d="M28 40c2-6 8-10 14-11" /><path d="M72 40c-2-6-8-10-14-11" />
  </>,
  // 06 · sunglasses
  () => <>{round}{ears}{nose}{smirk}
    <path d="M32 49h16v8H34a2 2 0 01-2-2z" />
    <path d="M52 49h16v6a2 2 0 01-2 2H52z" />
    <path d="M48 52h4" /><path d="M32 49l-6-3" /><path d="M68 49l6-3" />
  </>,
  // 07 · bald, big ears
  () => <>{oval}{eyesWide}{browsRaised}{nose}{grin}
    <path d="M27 50c-6 0-9 4-9 8.5s3 8.5 9 8.5" />
    <path d="M73 50c6 0 9 4 9 8.5s-3 8.5-9 8.5" />
  </>,
  // 08 · spiked hair
  () => <>{round}{ears}{eyesDots}{browsFlat}{nose}{smile}
    <path d="M28 42l3-11 6 8 5-12 6 11 5-11 6 12 6-8 3 11" />
  </>,
  // 09 · top knot
  () => <>{oval}{ears}{eyesSquint}{nose}{straight}
    <path d="M29 44c4-9 12-13 21-13s17 4 21 13" />
    <circle cx="50" cy="22" r="7" />
  </>,
  // 10 · bandana
  () => <>{round}{ears}{eyesDots}{nose}{grin}
    <path d="M25 45a25 25 0 0150 0z" />
    <path d="M25 45l-9 3 5 5z" />
    <path d="M36 38l4 4" /><path d="M46 35l4 4" /><path d="M56 36l4 4" />
  </>,
  // 11 · curls
  () => <>{round}{ears}{eyesDots}{browsRaised}{nose}{smile}
    <path d="M28 44a7 7 0 0110-7 8 8 0 0113-4 8 8 0 0113 4 7 7 0 0110 7" />
    <path d="M30 38a5 5 0 01-3-6" /><path d="M70 38a5 5 0 003-6" />
  </>,
  // 12 · long hair
  () => <>{long}{eyesDots}{browsFlat}{nose}{smirk}
    <path d="M28 52c-2-16 8-26 22-26s24 10 22 26" />
    <path d="M27 50c-4 12-4 24 0 33" /><path d="M73 50c4 12 4 24 0 33" />
  </>,
];

export const MASCOT_COUNT = MASCOTS.length;

/** Stable per seed: the same player always draws the same face. */
export function mascotIndex(seed: string) {
  return hash(seed || "player") % MASCOTS.length;
}

export function Mascot({ seed, className, title }: { seed: string; className?: string; title?: string }) {
  const draw = MASCOTS[mascotIndex(seed)];
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={title ?? "Player illustration"}>
      <g fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        {draw()}
      </g>
    </svg>
  );
}
