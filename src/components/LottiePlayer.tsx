import React, { useEffect, useRef } from "react";
import lottie, { AnimationItem } from "lottie-web/build/player/lottie_svg";

interface LottiePlayerProps {
  /** Absolute or relative URL of the Lottie JSON, e.g. "/animations/globe.json". */
  src: string;
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
  speed?: number;
  onComplete?: () => void;
}

/**
 * Path-based lottie-web wrapper used on the platform (keeps large animations
 * out of the JS bundle — the JSON is fetched at runtime from /animations/).
 */
export default function LottiePlayer({
  src,
  className,
  loop = true,
  autoplay = true,
  speed = 1,
  onComplete,
}: LottiePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const anim = lottie.loadAnimation({
      container: el,
      renderer: "svg",
      loop,
      autoplay,
      path: src,
    });
    anim.setSpeed(speed);
    if (onComplete) {
      anim.addEventListener("complete", () => onComplete());
    }
    animRef.current = anim;
    return () => {
      anim.destroy();
      animRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={className} aria-hidden="true" />;
}
