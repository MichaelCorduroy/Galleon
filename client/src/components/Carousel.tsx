import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons";

interface CarouselProps {
	children: ReactNode;
	trackClassName?: string;
}

// horizontally-scrolling row with prev/next arrows layered over the edges —
// arrows scroll by ~80% of the visible width and hide themselves once
// there's nothing further to scroll in that direction
export function Carousel({ children, trackClassName }: CarouselProps) {
	const trackRef = useRef<HTMLDivElement>(null);
	const [canScrollLeft, setCanScrollLeft] = useState(false);
	const [canScrollRight, setCanScrollRight] = useState(false);

	const updateArrows = () => {
		const el = trackRef.current;
		if (!el) return;
		setCanScrollLeft(el.scrollLeft > 4);
		setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
	};

	useEffect(() => {
		updateArrows();
		const el = trackRef.current;
		if (!el) return;
		el.addEventListener("scroll", updateArrows, { passive: true });
		window.addEventListener("resize", updateArrows);
		return () => {
			el.removeEventListener("scroll", updateArrows);
			window.removeEventListener("resize", updateArrows);
		};
		// re-check whenever the content changes size (e.g. shelf data arrives)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [children]);

	const scrollByPage = (dir: 1 | -1) => {
		const el = trackRef.current;
		if (!el) return;
		el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
	};

	return (
		<div className="carousel">
			<button
				className={`carousel-arrow carousel-arrow-left ${canScrollLeft ? "" : "carousel-arrow-hidden"}`}
				onClick={() => scrollByPage(-1)}
				aria-label="Scroll left"
				tabIndex={canScrollLeft ? 0 : -1}
			>
				<ChevronLeftIcon size={14} />
			</button>
			<div className={`carousel-track ${trackClassName ?? ""}`} ref={trackRef}>
				{children}
			</div>
			<button
				className={`carousel-arrow carousel-arrow-right ${canScrollRight ? "" : "carousel-arrow-hidden"}`}
				onClick={() => scrollByPage(1)}
				aria-label="Scroll right"
				tabIndex={canScrollRight ? 0 : -1}
			>
				<ChevronRightIcon size={14} />
			</button>
		</div>
	);
}
