"use client";

/**
 * Tattoo Pour Menu.
 *
 * Inspired by the coffee-pour-menu interaction: a menu of styles beside a stage.
 * Picking a style (or a photo) knocks the current print off the stage and
 * springs the next one in. Strictly black & white.
 */

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PourPhoto {
  id: string;
  title: string;
  area: string;
  src: string;
  thumb: string;
}

export interface PourCategory {
  id: string;
  name: string;
  description: string;
  photos: PourPhoto[];
}

export interface TattooPourMenuProps {
  categories: PourCategory[];
  /** Called when the visitor clicks the photo on stage. */
  onOpen?: (photo: PourPhoto, categoryId: string) => void;
  className?: string;
}

/** Small stable tilt per photo so every print rests at its own angle. */
const tiltOf = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return ((h % 7) - 3) * 0.9;
};

type Fx = { tilt: number; k: number; reduce: boolean };

const variants = {
  enter: ({ tilt, reduce }: Fx) => ({
    x: reduce ? 0 : 340,
    y: reduce ? 0 : -30,
    rotate: reduce ? tilt : tilt + 16,
    opacity: 0,
  }),
  center: ({ tilt, reduce }: Fx) => ({
    x: 0,
    y: 0,
    rotate: tilt,
    opacity: 1,
    transition: reduce
      ? { duration: 0.2 }
      : { type: "spring" as const, stiffness: 170, damping: 17, mass: 0.9, opacity: { duration: 0.15 } },
  }),
  exit: ({ tilt, k, reduce }: Fx) => ({
    x: reduce ? 0 : -140 - k * 40,
    y: reduce ? 0 : 640,
    rotate: reduce ? tilt : tilt - 26 - k * 12,
    opacity: reduce ? 0 : 1,
    transition: reduce
      ? { duration: 0.15 }
      : { duration: 0.7, ease: [0.6, 0, 1, 0.5] as [number, number, number, number], opacity: { delay: 0.5, duration: 0.2 } },
  }),
};

export function TattooPourMenu({ categories, onOpen, className }: TattooPourMenuProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = React.useId();
  const [catId, setCatId] = React.useState(categories[0]?.id);
  const [idx, setIdx] = React.useState(0);
  const btns = React.useRef<(HTMLButtonElement | null)[]>([]);

  const cat = categories.find((c) => c.id === catId) ?? categories[0];
  const photo = cat?.photos[idx];
  const count = cat?.photos.length ?? 0;

  const pickCategory = (id: string) => {
    if (id === catId) return;
    setCatId(id);
    setIdx(0);
  };
  const go = (n: number) => count && setIdx(((n % count) + count) % count);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = categories.findIndex((c) => c.id === catId);
    let n = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") n = (i + 1) % categories.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") n = (i - 1 + categories.length) % categories.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = categories.length - 1;
    if (n < 0) return;
    e.preventDefault();
    pickCategory(categories[n].id);
    btns.current[n]?.focus();
  };

  if (!cat || !photo) return null;

  const fx: Fx = { tilt: tiltOf(photo.id), k: tiltOf(photo.id + cat.id) > 0 ? 1 : 0, reduce };
  const start = Math.min(Math.max(0, idx - 2), Math.max(0, count - 6));
  const strip = cat.photos.slice(start, start + 6);

  return (
    <div className={cn("grid w-full items-start gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-14", className)}>
      <div>
        <div
          role="radiogroup"
          aria-label="Estilos de tatuagem"
          onKeyDown={onKeyDown}
          className="grid grid-cols-2 gap-1.5 md:flex md:flex-col md:gap-1"
        >
          {categories.map((c, i) => {
            const active = c.id === cat.id;
            return (
              <button
                key={c.id}
                ref={(el) => {
                  btns.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                onPointerEnter={(e) => e.pointerType === "mouse" && pickCategory(c.id)}
                onFocus={() => pickCategory(c.id)}
                onClick={() => pickCategory(c.id)}
                className="group relative px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-black md:px-6 md:py-3.5"
              >
                {active && (
                  <motion.span
                    layoutId={`${uid}-pill`}
                    className="absolute inset-0 bg-black"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative flex items-baseline justify-between gap-4">
                  <span
                    className={cn(
                      "font-display text-[34px] leading-none tracking-wide transition-colors duration-300 md:text-[64px]",
                      active ? "text-white" : "text-black/35 group-hover:text-black/70",
                    )}
                  >
                    {c.name}
                  </span>
                  <span
                    className={cn(
                      "hidden text-xs tracking-[0.2em] uppercase transition-colors duration-300 md:block",
                      active ? "text-white/70" : "text-black/35",
                    )}
                  >
                    {String(c.photos.length).padStart(2, "0")}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-5 hidden max-w-sm px-6 text-[15px] leading-relaxed text-black/60 md:block">{cat.description}</p>
      </div>

      <div>
        <div className="relative aspect-[5/6] w-full overflow-hidden bg-[#e9e9e7] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] sm:aspect-[9/10]">
          {/* counter */}
          <div className="absolute inset-x-0 bottom-0 h-[14%] bg-gradient-to-t from-black/10 to-transparent" />
          <EllipseShadow />
          <AnimatePresence custom={fx}>
            <motion.button
              key={`${cat.id}-${photo.id}`}
              type="button"
              custom={fx}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              onClick={() => onOpen?.(photo, cat.id)}
              aria-label={`Ampliar: ${photo.title}`}
              className="group absolute inset-x-0 top-[6%] mx-auto block w-[54%] cursor-zoom-in bg-white p-2 pb-2 shadow-[0_28px_40px_-22px_rgba(0,0,0,0.65),0_2px_4px_rgba(0,0,0,0.2)] outline-none focus-visible:ring-2 focus-visible:ring-black sm:p-2.5"
            >
              <img
                src={photo.src}
                alt={`${photo.title} — tatuagem em ${photo.area.toLowerCase()}`}
                draggable={false}
                className="aspect-[3/4] w-full object-cover grayscale transition duration-500 group-hover:grayscale-0"
              />
              <span className="absolute right-4 top-4 grid size-8 place-items-center bg-black text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Expand className="size-4" aria-hidden />
              </span>
            </motion.button>
          </AnimatePresence>

          <div className="absolute inset-x-4 bottom-3 z-10 flex items-end justify-between gap-3 text-black">
            <div className="min-w-0">
              <p className="truncate font-display text-2xl leading-none tracking-wide sm:text-3xl">{photo.title}</p>
              <p className="mt-1 text-[11px] tracking-[0.22em] text-black/55 uppercase">{photo.area}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="mr-2 text-xs tabular-nums tracking-widest text-black/55">
                {String(idx + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={() => go(idx - 1)}
                aria-label="Foto anterior"
                className="grid size-9 place-items-center border border-black/70 transition-colors hover:bg-black hover:text-white focus-visible:ring-2 focus-visible:ring-black focus-visible:outline-none"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => go(idx + 1)}
                aria-label="Próxima foto"
                className="grid size-9 place-items-center border border-black/70 transition-colors hover:bg-black hover:text-white focus-visible:ring-2 focus-visible:ring-black focus-visible:outline-none"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-6 gap-1.5" role="group" aria-label="Fotos deste estilo">
          {strip.map((p, i) => {
            const n = start + i;
            const active = n === idx;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setIdx(n)}
                aria-label={`Ver ${p.title}`}
                aria-current={active}
                className={cn(
                  "relative aspect-square overflow-hidden outline-none transition focus-visible:ring-2 focus-visible:ring-black",
                  active ? "ring-2 ring-black ring-offset-2 ring-offset-white" : "opacity-60 hover:opacity-100",
                )}
              >
                <img src={p.thumb} alt="" loading="lazy" draggable={false} className="size-full object-cover grayscale" />
              </button>
            );
          })}
        </div>
        <p aria-live="polite" className="sr-only">
          {`${cat.name}: ${photo.title}, foto ${idx + 1} de ${count}`}
        </p>
      </div>
    </div>
  );
}

/** Soft contact shadow where prints land on the stage. */
function EllipseShadow() {
  return (
    <div
      aria-hidden
      className="absolute inset-x-[14%] bottom-[13%] h-6 rounded-[50%] bg-black/25 blur-xl"
    />
  );
}

export default TattooPourMenu;
