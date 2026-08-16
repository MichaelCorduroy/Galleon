import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { coverUrl, fetchGenreWeb, type GenreWebAlbum } from "../api";
import { buildGenreWebLayout, type PlacedAlbum } from "../genreWebLayout";
import { SearchIcon } from "../icons";

interface GenreWebProps {
	onOpenAlbum: (album: GenreWebAlbum) => void;
}

const ORB_RADIUS = 1.1;
const HUB_COLOR_BLACK_BG = 0x88a888;
const HUB_COLOR_WHITE_BG = 0x557755;
const LINE_COLOR_BLACK_BG = 0x445544;
const LINE_COLOR_WHITE_BG = 0xc4d4c4;
const DIM_OPACITY = 0.15;

export function GenreWeb({ onOpenAlbum }: GenreWebProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [query, setQuery] = useState("");
	const [bgMode, setBgMode] = useState<"black" | "white">("black");
	const [albumCount, setAlbumCount] = useState(0);

	// mutable handles the render loop needs, kept out of React state so
	// updating them (search filter, bg toggle) never triggers a re-mount
	const queryRef = useRef("");
	const bgModeRef = useRef<"black" | "white">("black");
	const onOpenAlbumRef = useRef(onOpenAlbum);
	onOpenAlbumRef.current = onOpenAlbum;

	useEffect(() => {
		queryRef.current = query;
	}, [query]);

	useEffect(() => {
		bgModeRef.current = bgMode;
	}, [bgMode]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		let cancelled = false;
		let frameId = 0;
		let resizeObserver: ResizeObserver | undefined;

		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
		camera.position.set(0, 6, 34);

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		container.appendChild(renderer.domElement);

		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.dampingFactor = 0.08;
		controls.autoRotate = true;
		controls.autoRotateSpeed = 0.35;
		controls.minDistance = 6;
		controls.maxDistance = 90;

		const ambient = new THREE.AmbientLight(0xffffff, 0.7);
		const key = new THREE.DirectionalLight(0xffffff, 1.1);
		key.position.set(10, 15, 12);
		const fill = new THREE.PointLight(0xffffff, 0.5);
		fill.position.set(-14, -8, -10);
		scene.add(ambient, key, fill);

		const orbGroup = new THREE.Group();
		const hubGroup = new THREE.Group();
		const lineGroup = new THREE.Group();
		scene.add(lineGroup, hubGroup, orbGroup);

		const raycaster = new THREE.Raycaster();
		const pointerNdc = new THREE.Vector2();
		let hovered: THREE.Mesh | null = null;
		let pointerInside = false;

		const textureLoader = new THREE.TextureLoader();
		textureLoader.crossOrigin = "anonymous";
		const textureCache = new Map<string, THREE.Texture>();
		const orbMeshes: THREE.Mesh[] = [];

		function loadTexture(cover: string | null): THREE.Texture | null {
			if (!cover) return null;
			const url = coverUrl(cover);
			if (!url) return null;
			const cached = textureCache.get(url);
			if (cached) return cached;
			const tex = textureLoader.load(url);
			tex.colorSpace = THREE.SRGBColorSpace;
			textureCache.set(url, tex);
			return tex;
		}

		function applyBackground(mode: "black" | "white") {
			const bg = mode === "black" ? 0x000000 : 0xffffff;
			scene.background = new THREE.Color(bg);
			const hubColor = mode === "black" ? HUB_COLOR_BLACK_BG : HUB_COLOR_WHITE_BG;
			const lineColor = mode === "black" ? LINE_COLOR_BLACK_BG : LINE_COLOR_WHITE_BG;
			hubGroup.children.forEach((child) => {
				const mesh = child as THREE.Mesh;
				(mesh.material as THREE.MeshBasicMaterial).color.setHex(hubColor);
			});
			lineGroup.children.forEach((child) => {
				const line = child as THREE.LineSegments;
				(line.material as THREE.LineBasicMaterial).color.setHex(lineColor);
			});
		}

		let placedAlbums: PlacedAlbum[] = [];

		fetchGenreWeb().then((data) => {
			if (cancelled || !data) {
				if (!cancelled) setError(true);
				setLoading(false);
				return;
			}

			const layout = buildGenreWebLayout(data.genres, data.albums);
			placedAlbums = layout.albums;
			setAlbumCount(placedAlbums.length);

			for (const hub of layout.hubs) {
				const geo = new THREE.SphereGeometry(0.35, 12, 12);
				const mat = new THREE.MeshBasicMaterial({ color: HUB_COLOR_BLACK_BG, transparent: true, opacity: 0.85 });
				const mesh = new THREE.Mesh(geo, mat);
				mesh.position.set(hub.position.x, hub.position.y, hub.position.z);
				hubGroup.add(mesh);
			}

			const linePositions: number[] = [];
			for (const album of placedAlbums) {
				for (const hubPos of album.hubPositions) {
					linePositions.push(album.position.x, album.position.y, album.position.z, hubPos.x, hubPos.y, hubPos.z);
				}
			}
			if (linePositions.length > 0) {
				const lineGeo = new THREE.BufferGeometry();
				lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
				const lineMat = new THREE.LineBasicMaterial({ color: LINE_COLOR_BLACK_BG, transparent: true, opacity: 0.35 });
				lineGroup.add(new THREE.LineSegments(lineGeo, lineMat));
			}

			for (const album of placedAlbums) {
				const geo = new THREE.SphereGeometry(ORB_RADIUS, 28, 28);
				const texture = loadTexture(album.cover);
				const mat = new THREE.MeshStandardMaterial({
					map: texture ?? undefined,
					color: texture ? 0xffffff : 0x556b55,
					roughness: 0.35,
					metalness: 0.15,
					transparent: true,
					opacity: 1,
				});
				const mesh = new THREE.Mesh(geo, mat);
				mesh.position.set(album.position.x, album.position.y, album.position.z);
				mesh.userData.album = album;
				orbGroup.add(mesh);
				orbMeshes.push(mesh);
			}

			applyBackground(bgModeRef.current);
			setLoading(false);
		});

		function resize() {
			const w = container.clientWidth;
			const h = container.clientHeight;
			if (w === 0 || h === 0) return;
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
			renderer.setSize(w, h);
		}

		resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(container);
		resize();
		applyBackground(bgModeRef.current);

		function onPointerMove(e: PointerEvent) {
			const rect = renderer.domElement.getBoundingClientRect();
			pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
			pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
			pointerInside = true;
			if (tooltipRef.current) {
				tooltipRef.current.style.left = `${e.clientX - rect.left + 14}px`;
				tooltipRef.current.style.top = `${e.clientY - rect.top + 14}px`;
			}
		}
		function onPointerLeave() {
			pointerInside = false;
		}

		const matcher = (album: PlacedAlbum, q: string) =>
			!q || album.album.toLowerCase().includes(q) || album.artist.toLowerCase().includes(q);

		// raycasts fresh from the click's own coordinates rather than trusting
		// the hover state from the last pointermove — a click can arrive
		// without a preceding move (touch, some automation/assistive input),
		// and the auto-rotating scene means a stale hover target may no
		// longer be under the cursor by the time the click actually fires
		function onClick(e: MouseEvent) {
			// force matrices current before raycasting rather than trusting
			// whatever the last animation frame left behind — OrbitControls'
			// autoRotate mutates the camera continuously, and a click can land
			// in the gap between two frames where matrixWorld is momentarily stale
			camera.updateMatrixWorld();
			for (const m of orbMeshes) m.updateMatrixWorld();

			const rect = renderer.domElement.getBoundingClientRect();
			const ndc = new THREE.Vector2(
				((e.clientX - rect.left) / rect.width) * 2 - 1,
				-((e.clientY - rect.top) / rect.height) * 2 + 1,
			);
			raycaster.setFromCamera(ndc, camera);
			const q = queryRef.current.trim().toLowerCase();
			const hit = raycaster
				.intersectObjects(orbMeshes, false)
				.find((h) => matcher((h.object as THREE.Mesh).userData.album as PlacedAlbum, q));
			if (hit) onOpenAlbumRef.current((hit.object as THREE.Mesh).userData.album as GenreWebAlbum);
		}

		renderer.domElement.addEventListener("pointermove", onPointerMove);
		renderer.domElement.addEventListener("pointerleave", onPointerLeave);
		renderer.domElement.addEventListener("click", onClick);

		let appliedBgMode = bgModeRef.current;

		function tick() {
			frameId = requestAnimationFrame(tick);
			controls.update();

			if (bgModeRef.current !== appliedBgMode) {
				appliedBgMode = bgModeRef.current;
				applyBackground(appliedBgMode);
			}

			const q = queryRef.current.trim().toLowerCase();
			for (const mesh of orbMeshes) {
				const album = mesh.userData.album as PlacedAlbum;
				const mat = mesh.material as THREE.MeshStandardMaterial;
				mat.opacity = matcher(album, q) ? 1 : DIM_OPACITY;
			}

			if (pointerInside) {
				raycaster.setFromCamera(pointerNdc, camera);
				const hits = raycaster.intersectObjects(orbMeshes, false);
				const validHit = hits.find((h) => {
					const a = (h.object as THREE.Mesh).userData.album as PlacedAlbum;
					return matcher(a, q);
				});
				const nextHovered = (validHit?.object as THREE.Mesh) ?? null;
				if (nextHovered !== hovered) {
					if (hovered) hovered.scale.setScalar(1);
					hovered = nextHovered;
					if (hovered) hovered.scale.setScalar(1.18);
					renderer.domElement.style.cursor = hovered ? "pointer" : "grab";
				}
				if (hovered && tooltipRef.current) {
					const a = hovered.userData.album as PlacedAlbum;
					tooltipRef.current.textContent = `${a.album} · ${a.artist}`;
					tooltipRef.current.style.display = "block";
				} else if (tooltipRef.current) {
					tooltipRef.current.style.display = "none";
				}
			} else if (tooltipRef.current) {
				tooltipRef.current.style.display = "none";
			}

			renderer.render(scene, camera);
		}
		tick();

		return () => {
			cancelled = true;
			cancelAnimationFrame(frameId);
			resizeObserver?.disconnect();
			renderer.domElement.removeEventListener("pointermove", onPointerMove);
			renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
			renderer.domElement.removeEventListener("click", onClick);
			controls.dispose();
			orbMeshes.forEach((m) => {
				m.geometry.dispose();
				(m.material as THREE.Material).dispose();
			});
			hubGroup.children.forEach((c) => {
				(c as THREE.Mesh).geometry.dispose();
				((c as THREE.Mesh).material as THREE.Material).dispose();
			});
			lineGroup.children.forEach((c) => {
				(c as THREE.LineSegments).geometry.dispose();
				((c as THREE.LineSegments).material as THREE.Material).dispose();
			});
			textureCache.forEach((t) => t.dispose());
			renderer.dispose();
			if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
		};
	}, []);

	return (
		<div className="genre-web">
			<div className="genre-web-controls">
				<div className="genre-web-search">
					<SearchIcon size={13} />
					<input
						type="text"
						placeholder="Find an album or artist in the web…"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
				</div>
				<button
					className="genre-web-bg-toggle"
					onClick={() => setBgMode((m) => (m === "black" ? "white" : "black"))}
				>
					{bgMode === "black" ? "White background" : "Black background"}
				</button>
			</div>
			<div className="genre-web-canvas" ref={containerRef}>
				{loading && <div className="genre-web-status">Building your genre web…</div>}
				{!loading && error && <div className="genre-web-status">Couldn't load the genre web.</div>}
				{!loading && !error && albumCount === 0 && (
					<div className="genre-web-status">No albums to map yet.</div>
				)}
				<div className="genre-web-tooltip" ref={tooltipRef} />
			</div>
		</div>
	);
}
