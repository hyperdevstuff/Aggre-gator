import { useEffect, useRef } from "react";
import {
  loadFigure,
  mountFigure,
  valueAt,
  type HairlineHandle,
} from "@/lib/hairline/host";
import { cn } from "@/lib/utils";

type HairlineFigureProps = {
  /** The figure, as `name` in its `hairline({ … })` call. Resolved at `/<name>.js`. */
  name: string;
  /** 0…1, mapped onto the figure's own `range`. The mount value. */
  intensity?: number;
  className?: string;
  /**
   * The mounted figure, for the scroll hook. `focus(i)` is the same code path
   * the pointer uses, so a step change and a hover behave identically.
   */
  onHandle?: (handle: HairlineHandle | null) => void;
};

/**
 * One live hairline figure. The kernel injects its own stylesheet and its
 * `data-hairline` box on first use, and the palette comes from the
 * `--hairline-*` custom properties on any ancestor — see the wet-slate block in
 * `index.css`. Nothing here sets a colour.
 */
export function HairlineFigure({
  name,
  intensity = 0.5,
  className,
  onHandle,
}: HairlineFigureProps) {
  const host = useRef<HTMLDivElement>(null);
  // Both read through refs so that a new slider position or an inline callback
  // does not tear the figure down and start it again. They are written in an
  // effect rather than during render: the mount effect below runs once, and it
  // reads these, so committing them first is all that matters.
  const start = useRef(intensity);
  const notify = useRef(onHandle);

  useEffect(() => {
    start.current = intensity;
    notify.current = onHandle;
  });

  useEffect(() => {
    const element = host.current;
    if (!element) return;

    let cancelled = false;
    let handle: HairlineHandle | null = null;

    loadFigure(name)
      .then((spec) => {
        if (cancelled || !host.current) return;
        handle = mountFigure(spec, element, valueAt(spec.range, start.current));
        notify.current?.(handle);
      })
      .catch(() => {
        // A figure that cannot be fetched leaves an empty box.
        if (!cancelled) notify.current?.(null);
      });

    return () => {
      cancelled = true;
      handle?.destroy();
      notify.current?.(null);
    };
  }, [name]);

  // No children: the kernel's svg and live region are added imperatively, and
  // the box is labelled by `mountFigure`. `role="img"` and `aria-label` are the
  // accessible name, so there is nothing to render here.
  return <div ref={host} className={cn("figure-box", className)} />;
}