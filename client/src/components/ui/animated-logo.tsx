"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const ALLIGATOR_PATH =
  "m242.5 113.5c-2.56-17.48-14.1-25.94-27.53-25.94-8.34 0-14.17 3.5-18.57 7.6l-68.48-15.24c-4.68-15.83-17.82-26.44-33.98-26.44-14.27 0-25 7.72-31.21 19.26-1.22-0.11-2.49-0.17-3.92-0.17-17.71 0-34.05 11.72-36.93 31.8-11.78 7.29-15.86 18.79-15.86 32.8 0 28.64 22.28 58.46 59.94 58.46 9.95 0 17.17-1.65 28.64-4.12l112.7-24.8c23.47-5.3 38.86-24.67 35.17-53.21zm-36.75 45.59-112.7 24.79c-10.37 2.49-17.94 4.68-27.11 4.68-32.87 0-52.94-25.63-52.94-51.57 0-11.72 4.12-21.21 16.24-27.9l0.27-1.41c0.87-16.39 13.27-27.49 29.68-27.49 2.69 0 4.82 0.22 7.03 0.48l1.13-1.05c6.39-11.59 15.23-18.61 26.93-18.61 13.91 0 25.43 9.95 28.52 24.28l1.08 0.61 74.02 16.81 1.18-0.28c5.5-5.27 9.85-7.85 15.24-7.85 11.08 0 20.57 8.1 21.61 22.61 0.39 5.55-0.2 10.24-1.18 13.15h-38.34l-12.23 10.13-17.37-15.67-21.26 17.98-16.44-13.07-17.22 7.02-4.2 8.21c5.59 0 11.72-3.9 20.02-6.61l17.57 13.58 21.36-17.79 17.98 15.56 14.01-12.69h34.72c-4.84 11.51-13.2 18.91-27.62 22.1z";
const EYE_PATH =
  "m224 111.2c0.77-5.99-3.89-7.47-6.88-7.47-2.69 0-4.94 0.98-5.86 2.52l12.27 10.5c0.44-1.29 0.27-1.94 0.47-5.55z";
const PAPERCLIP_PATH =
  "m109 80.17c-4.24-6.18-9.29-8.59-15.11-8.18-6.18 0.44-11.39 4.09-15.09 10.1l-41.08 52.93c-8.78 12.79-4.84 29.19 8 36.39 10.95 6.32 25 3.34 32.46-5.34l34.19-46.75-5.61-3.43-33.29 45.02c-6.77 9.18-16.87 7.84-22.34 5.41-9.11-3.94-13.05-16.2-6.61-26.99l40.22-54.62c2.99-4.4 6.26-6.13 10.97-5.82 6.29 0.42 10.67 6.83 10 14.03-0.23 2.89-1.49 5.29-2.71 6.98l-29.24 40.07c-2.46 3.5-5.01 4.2-7.85 2.82-3.69-1.83-4.21-5.81-2.34-8.67l24.21-33.43-5.15-4.47-24.54 34.67c-4.78 6.77-2.43 15.12 4.52 18.42 6.45 3.06 12.89 0.45 16.16-4.5l30.08-41.84c5.55-7.78 4.7-16.35 0.15-22.8z";

export function AnimatedLogo({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("relative w-full max-w-[250px] aspect-square", className)}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 250 250"
        className="w-full h-full text-current drop-shadow-sm"
      >
        <defs>
          <clipPath id="top-jaw-clip">
            <polygon points="0,0 250,0 250,113 230,124 213,108 192,126 175,113 158,120 154,128 0,128" />
          </clipPath>
          <clipPath id="bottom-jaw-clip">
            <polygon points="0,128 154,128 158,120 175,113 192,126 213,108 230,124 250,113 250,250 0,250" />
          </clipPath>
        </defs>

        {/* Top Jaw (includes eye) */}
        <motion.g
          clipPath="url(#top-jaw-clip)"
          style={{ originX: "154px", originY: "128px" }}
          animate={{
            rotate: [0, -6, -16, -6, 0, 0],
          }}
          transition={{
            duration: 4,
            times: [0, 0.2, 0.4, 0.6, 0.7, 1],
            repeat: Infinity,
            repeatDelay: 2,
            ease: "easeInOut",
          }}
        >
          <path d={ALLIGATOR_PATH} fill="currentColor" />
          <path d={EYE_PATH} fill="currentColor" />
        </motion.g>

        {/* Bottom Jaw */}
        <motion.g
          clipPath="url(#bottom-jaw-clip)"
          style={{ originX: "154px", originY: "128px" }}
          animate={{
            rotate: [0, 6, 16, 6, 0, 0],
          }}
          transition={{
            duration: 4,
            times: [0, 0.2, 0.4, 0.6, 0.7, 1],
            repeat: Infinity,
            repeatDelay: 2,
            ease: "easeInOut",
          }}
        >
          <path d={ALLIGATOR_PATH} fill="currentColor" />
        </motion.g>

        {/* Paperclip */}
        <motion.path
          d={PAPERCLIP_PATH}
          fill="currentColor"
          initial={{ x: 120, y: -20, opacity: 0, rotate: 20 }}
          animate={{
            x: [120, 120, 120, 60, 0, 0],
            y: [-20, -20, -20, -10, 0, 0],
            rotate: [20, 20, 20, 10, 0, 0],
            opacity: [0, 0, 1, 1, 0, 1],
          }}
          transition={{
            duration: 4,
            times: [0, 0.2, 0.4, 0.6, 0.7, 1],
            repeat: Infinity,
            repeatDelay: 2,
            ease: "easeInOut",
          }}
        />
      </svg>
    </div>
  );
}