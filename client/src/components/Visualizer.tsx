import { useEffect, useRef } from "react";

interface VisualizerProps {
	getFrequencyData: (out: Uint8Array) => void;
	binCount: number;
	isPlaying: boolean;
}

const BARS = 40;

export function Visualizer({ getFrequencyData, binCount, isPlaying }: VisualizerProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const rafRef = useRef<number>(0);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const data = new Uint8Array(Math.max(binCount, 1));
		const w = canvas.width;
		const h = canvas.height;
		const gap = 3;
		const barWidth = w / BARS - gap;
		const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#93a887";

		const draw = () => {
			ctx.clearRect(0, 0, w, h);
			if (isPlaying) getFrequencyData(data);

			ctx.fillStyle = accent;
			for (let i = 0; i < BARS; i++) {
				const value = isPlaying ? data[Math.floor((i / BARS) * data.length)] : 0;
				const barHeight = Math.max(2, Math.round((value / 255) * h));
				const x = i * (barWidth + gap);
				const y = (h - barHeight) / 2;
				ctx.globalAlpha = 0.35 + (value / 255) * 0.65;
				ctx.beginPath();
				ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
				ctx.fill();
			}
			rafRef.current = requestAnimationFrame(draw);
		};

		rafRef.current = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(rafRef.current);
	}, [getFrequencyData, binCount, isPlaying]);

	return <canvas ref={canvasRef} className="visualizer" width={400} height={48} />;
}
