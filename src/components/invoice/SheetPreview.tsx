import { useEffect, useRef, useState, type ReactNode } from "react";
import { SHEET_WIDTH } from "./DocumentSheet";

/** Scales the fixed-width A4 sheet down to fit narrow screens without touching the captured element. */
export function SheetPreview({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      const s = Math.min(1, outer.clientWidth / SHEET_WIDTH);
      setScale(s);
      setHeight(inner.offsetHeight * s);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outerRef} className="w-full" style={{ height }}>
      <div
        className="mx-auto origin-top-left"
        style={{ width: SHEET_WIDTH, transform: `scale(${scale})` }}
      >
        <div ref={innerRef} className="shadow-sheet">
          {children}
        </div>
      </div>
    </div>
  );
}
