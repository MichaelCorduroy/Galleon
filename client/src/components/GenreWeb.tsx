import { useEffect, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { coverUrl, fetchGenreWeb, type GenreWebAlbum, type Song } from "../api";
import { buildGenreWebLayout, genreHue, ORB_RADIUS, type PlacedAlbum } from "../genreWebLayout";
import { CoverArt } from "./CoverArt";
import { CloseIcon, SearchIcon } from "../icons";

interface GenreWebProps {
	library: Song[];
	onOpenAlbum: (album: GenreWebAlbum) => void;
	onPlayPath: (songs: Song[]) => void;
	onQueuePath: (songs: Song[]) => void;
}

const HUB_COLOR_BLACK_BG = 0x88a888;
const HUB_COLOR_WHITE_BG = 0x557755;
const LINE_COLOR_BLACK_BG = 0x445544;
const LINE_COLOR_WHITE_BG = 0xc4d4c4;
const PATH_COLOR = 0xd98c3a;

// construction/loading is spread over time so a large library doesn't
// block the main thread with one long synchronous build
const BUILD_BATCH_SIZE = 60;
const TEXTURE_LOADS_PER_PASS = 24;
const TEXTURE_CHECK_INTERVAL_MS = 350;

const albumKey = (a: { artist: string; album: string }) => `${a.artist}::${a.album}`;

function createGlowTexture(): THREE.CanvasTexture {
	const size = 128;
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d")!;
	const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
	gradient.addColorStop(0, "rgba(255,255,255,0.9)");
	gradient.addColorStop(0.4, "rgba(255,255,255,0.32)");
	gradient.addColorStop(1, "rgba(255,255,255,0)");
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, size, size);
	return new THREE.CanvasTexture(canvas);
}

export function GenreWeb({ library, onOpenAlbum, onPlayPath, onQueuePath }: GenreWebProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [query, setQuery] = useState("");
	const [bgMode, setBgMode] = useState<"black" | "white">("black");
	const [albumCount, setAlbumCount] = useState(0);
	const [pathMode, setPathMode] = useState(false);
	const [path, setPath] = useState<PlacedAlbum[]>([]);
	const [genreList, setGenreList] = useState<string[]>([]);
	const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
	const [showAuras, setShowAuras] = useState(false);

	// mutable handles the render loop needs, kept out of React state so
	// updating them (search filter, bg toggle, etc.) never triggers a re-mount
	const queryRef = useRef("");
	const bgModeRef = useRef<"black" | "white">("black");
	const pathModeRef = useRef(false);
	const pathRef = useRef<PlacedAlbum[]>([]);
	const selectedGenresRef = useRef<Set<string>>(new Set());
	const showAurasRef = useRef(false);
	const onOpenAlbumRef = useRef(onOpenAlbum);
	onOpenAlbumRef.current = onOpenAlbum;

	const togglePathAlbum = (album: PlacedAlbum) => {
		setPath((prev) => {
			const exists = prev.some((a) => albumKey(a) === albumKey(album));
			return exists ? prev.filter((a) => albumKey(a) !== albumKey(album)) : [...prev, album];
		});
	};
	const togglePathAlbumRef = useRef(togglePathAlbum);
	togglePathAlbumRef.current = togglePathAlbum;

	useEffect(() => {
		queryRef.current = query;
	}, [query]);

	useEffect(() => {
		bgModeRef.current = bgMode;
	}, [bgMode]);

	useEffect(() => {
		pathModeRef.current = pathMode;
	}, [pathMode]);

	useEffect(() => {
		pathRef.current = path;
	}, [path]);

	useEffect(() => {
		selectedGenresRef.current = selectedGenres;
	}, [selectedGenres]);

	useEffect(() => {
		showAurasRef.current = showAuras;
	}, [showAuras]);

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
		const auraGroup = new THREE.Group();
		auraGroup.visible = showAurasRef.current;
		scene.add(lineGroup, auraGroup, hubGroup, orbGroup);

		const glowTexture = createGlowTexture();

		// the user's traced playlist path — a separate, bright, always-on-top
		// line distinct from the dim genre-relationship threads in lineGroup
		const pathLine = new THREE.Line(
			new THREE.BufferGeometry(),
			new THREE.LineBasicMaterial({ color: PATH_COLOR, transparent: true, opacity: 0.9, depthTest: false }),
		);
		pathLine.renderOrder = 1;
		pathLine.visible = false;
		scene.add(pathLine);

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

		// combined visibility test: free-text search AND (no genre filter, or
		// the album carries at least one of the checked genres)
		function isHighlighted(album: PlacedAlbum, q: string, genreFilter: Set<string>): boolean {
			if (q && !album.album.toLowerCase().includes(q) && !album.artist.toLowerCase().includes(q)) return false;
			if (genreFilter.size > 0 && !album.genres.some((g) => genreFilter.has(g))) return false;
			return true;
		}

		fetchGenreWeb().then((data) => {
			if (cancelled || !data) {
				if (!cancelled) setError(true);
				setLoading(false);
				return;
			}

			const layout = buildGenreWebLayout(data.genres, data.albums);
			setAlbumCount(layout.albums.length);
			setGenreList(data.genres);

			for (const hub of layout.hubs) {
				const geo = new THREE.SphereGeometry(0.35, 10, 10);
				const mat = new THREE.MeshBasicMaterial({ color: HUB_COLOR_BLACK_BG, transparent: true, opacity: 0.85 });
				const mesh = new THREE.Mesh(geo, mat);
				mesh.position.set(hub.position.x, hub.position.y, hub.position.z);
				hubGroup.add(mesh);

				const hue = genreHue(hub.genre) / 360;
				const color = new THREE.Color().setHSL(hue, 0.65, 0.55);
				const auraMat = new THREE.SpriteMaterial({
					map: glowTexture,
					color,
					transparent: true,
					opacity: 0.5,
					depthWrite: false,
				});
				const sprite = new THREE.Sprite(auraMat);
				sprite.position.set(hub.position.x, hub.position.y, hub.position.z);
				sprite.scale.set(26, 26, 1);
				auraGroup.add(sprite);
			}

			const linePositions: number[] = [];
			for (const album of layout.albums) {
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

			applyBackground(bgModeRef.current);
			setLoading(false);

			// spread orb construction across frames instead of one long
			// synchronous loop — keeps the page responsive on large libraries
			let buildIndex = 0;
			function buildNextBatch() {
				if (cancelled) return;
				const end = Math.min(buildIndex + BUILD_BATCH_SIZE, layout.albums.length);
				for (; buildIndex < end; buildIndex++) {
					const album = layout.albums[buildIndex];
					const geo = new THREE.SphereGeometry(ORB_RADIUS, 18, 18);
					geo.computeBoundingSphere();
					// opaque, not transparent — matched albums are simply not drawn
					// at all (mesh.visible = false) rather than faded, which is
					// both cheaper (no blending pass) and avoids rendering a
					// transparent object's full fragment cost for nothing
					const mat = new THREE.MeshStandardMaterial({
						color: 0x556b55,
						roughness: 0.35,
						metalness: 0.15,
					});
					const mesh = new THREE.Mesh(geo, mat);
					mesh.position.set(album.position.x, album.position.y, album.position.z);
					mesh.userData.album = album;
					mesh.userData.textureLoaded = false;
					orbGroup.add(mesh);
					orbMeshes.push(mesh);
				}
				if (buildIndex < layout.albums.length) requestAnimationFrame(buildNextBatch);
			}
			buildNextBatch();
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
			// hidden (filtered-out) orbs aren't drawn, so they're excluded from
			// hit-testing by simply not being in this candidate list
			const hit = raycaster.intersectObjects(
				orbMeshes.filter((m) => m.visible),
				false,
			)[0];
			if (!hit) return;
			const album = (hit.object as THREE.Mesh).userData.album as PlacedAlbum;
			if (pathModeRef.current) togglePathAlbumRef.current(album);
			else onOpenAlbumRef.current(album as GenreWebAlbum);
		}

		renderer.domElement.addEventListener("pointermove", onPointerMove);
		renderer.domElement.addEventListener("pointerleave", onPointerLeave);
		renderer.domElement.addEventListener("click", onClick);

		let appliedBgMode = bgModeRef.current;
		let pathSignature = "";
		let lastTextureCheck = 0;

		function maybeLoadVisibleTextures(now: number) {
			if (now - lastTextureCheck < TEXTURE_CHECK_INTERVAL_MS) return;
			lastTextureCheck = now;
			const frustum = new THREE.Frustum();
			const projScreenMatrix = new THREE.Matrix4();
			projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
			frustum.setFromProjectionMatrix(projScreenMatrix);

			let loaded = 0;
			for (const mesh of orbMeshes) {
				if (loaded >= TEXTURE_LOADS_PER_PASS) break;
				if (mesh.userData.textureLoaded) continue;
				if (!frustum.intersectsObject(mesh)) continue;
				const album = mesh.userData.album as PlacedAlbum;
				const tex = loadTexture(album.cover);
				const mat = mesh.material as THREE.MeshStandardMaterial;
				if (tex) {
					mat.map = tex;
					mat.color.setHex(0xffffff);
					mat.needsUpdate = true;
				}
				mesh.userData.textureLoaded = true;
				loaded++;
			}
		}

		function tick() {
			frameId = requestAnimationFrame(tick);
			controls.update();

			if (bgModeRef.current !== appliedBgMode) {
				appliedBgMode = bgModeRef.current;
				applyBackground(appliedBgMode);
			}
			auraGroup.visible = showAurasRef.current;

			maybeLoadVisibleTextures(performance.now());

			const currentPath = pathRef.current;
			const pathSig = currentPath.map(albumKey).join("|");
			if (pathSig !== pathSignature) {
				pathSignature = pathSig;
				if (currentPath.length >= 2) {
					const positions: number[] = [];
					for (const a of currentPath) positions.push(a.position.x, a.position.y, a.position.z);
					pathLine.geometry.dispose();
					pathLine.geometry = new THREE.BufferGeometry();
					pathLine.geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
					pathLine.visible = true;
				} else {
					pathLine.visible = false;
				}
			}

			const q = queryRef.current.trim().toLowerCase();
			const genreFilter = selectedGenresRef.current;
			for (const mesh of orbMeshes) {
				const album = mesh.userData.album as PlacedAlbum;
				const visible = isHighlighted(album, q, genreFilter);
				mesh.visible = visible;
				if (!visible) continue; // no point updating material/scale on something we're not drawing
				const mat = mesh.material as THREE.MeshStandardMaterial;
				const selected = currentPath.some((a) => albumKey(a) === albumKey(album));
				mat.emissive.setHex(selected ? PATH_COLOR : 0x000000);
				mat.emissiveIntensity = selected ? 0.5 : 0;
				if (mesh !== hovered) mesh.scale.setScalar(selected ? 1.3 : 1);
			}

			if (pointerInside) {
				raycaster.setFromCamera(pointerNdc, camera);
				const hits = raycaster.intersectObjects(
					orbMeshes.filter((m) => m.visible),
					false,
				);
				const nextHovered = (hits[0]?.object as THREE.Mesh) ?? null;
				if (nextHovered !== hovered) {
					if (hovered) {
						const wasSelected = currentPath.some((a) => albumKey(a) === albumKey(hovered!.userData.album));
						hovered.scale.setScalar(wasSelected ? 1.3 : 1);
					}
					hovered = nextHovered;
					if (hovered) {
						const isSelected = currentPath.some((a) => albumKey(a) === albumKey(hovered!.userData.album));
						hovered.scale.setScalar(isSelected ? 1.4 : 1.18);
					}
					renderer.domElement.style.cursor = hovered ? "pointer" : "grab";
				}
				if (hovered && tooltipRef.current) {
					const a = hovered.userData.album as PlacedAlbum;
					const tag = pathModeRef.current
						? currentPath.some((p) => albumKey(p) === albumKey(a))
							? " (in path — click to remove)"
							: " (click to add to path)"
						: "";
					tooltipRef.current.textContent = `${a.album} · ${a.artist}${tag}`;
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
			auraGroup.children.forEach((c) => {
				((c as THREE.Sprite).material as THREE.Material).dispose();
			});
			glowTexture.dispose();
			lineGroup.children.forEach((c) => {
				(c as THREE.LineSegments).geometry.dispose();
				((c as THREE.LineSegments).material as THREE.Material).dispose();
			});
			pathLine.geometry.dispose();
			(pathLine.material as THREE.Material).dispose();
			textureCache.forEach((t) => t.dispose());
			renderer.dispose();
			if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
		};
	}, []);

	const resolvePathSongs = (): Song[] => {
		const songs: Song[] = [];
		for (const album of path) {
			songs.push(...library.filter((s) => s.artist === album.artist && s.album === album.album));
		}
		return songs;
	};

	const removeFromPath = (index: number) => {
		setPath((prev) => prev.filter((_, i) => i !== index));
	};

	const toggleGenreFilter = (genre: string) => {
		setSelectedGenres((prev) => {
			const next = new Set(prev);
			if (next.has(genre)) next.delete(genre);
			else next.add(genre);
			return next;
		});
	};

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
					className={`genre-web-path-toggle ${pathMode ? "active" : ""}`}
					onClick={() => setPathMode((v) => !v)}
				>
					{pathMode ? "Exit path mode" : "Build a path"}
				</button>
				<button
					className={`genre-web-aura-toggle ${showAuras ? "active" : ""}`}
					onClick={() => setShowAuras((v) => !v)}
				>
					{showAuras ? "Hide genre regions" : "Show genre regions"}
				</button>
				<button
					className="genre-web-bg-toggle"
					onClick={() => setBgMode((m) => (m === "black" ? "white" : "black"))}
				>
					{bgMode === "black" ? "White background" : "Black background"}
				</button>
			</div>

			{genreList.length > 0 && (
				<div className="genre-web-filter-row">
					{genreList.map((g) => {
						const active = selectedGenres.has(g);
						return (
							<button
								key={g}
								className={`genre-web-filter-chip ${active ? "active" : ""}`}
								style={{ "--chip-hue": genreHue(g) } as CSSProperties}
								onClick={() => toggleGenreFilter(g)}
							>
								{g}
							</button>
						);
					})}
					{selectedGenres.size > 0 && (
						<button className="text-btn" onClick={() => setSelectedGenres(new Set())}>
							Clear filters
						</button>
					)}
				</div>
			)}

			<div className="genre-web-canvas" ref={containerRef}>
				{loading && <div className="genre-web-status">Building your genre web…</div>}
				{!loading && error && <div className="genre-web-status">Couldn't load the genre web.</div>}
				{!loading && !error && albumCount === 0 && (
					<div className="genre-web-status">No albums to map yet.</div>
				)}
				<div className="genre-web-tooltip" ref={tooltipRef} />
			</div>

			{pathMode && (
				<div className="genre-web-path-tray">
					<div className="genre-web-path-header">
						<span>
							Path {path.length > 0 && `(${path.length})`}
						</span>
						<div className="genre-web-path-actions">
							<button className="text-btn" onClick={() => setPath([])} disabled={path.length === 0}>
								Clear
							</button>
							<button
								className="genre-web-path-btn"
								onClick={() => onQueuePath(resolvePathSongs())}
								disabled={path.length === 0}
							>
								Add to queue
							</button>
							<button
								className="genre-web-path-btn genre-web-path-btn-primary"
								onClick={() => onPlayPath(resolvePathSongs())}
								disabled={path.length === 0}
							>
								Play path
							</button>
						</div>
					</div>
					{path.length === 0 ? (
						<div className="genre-web-path-empty">Click albums in the web above to build a path.</div>
					) : (
						<div className="genre-web-path-list">
							{path.map((a, i) => (
								<div key={albumKey(a)} className="genre-web-path-item">
									<span className="genre-web-path-num">{i + 1}</span>
									<CoverArt src={coverUrl(a.cover)} alt="" className="cover-art-sm" iconSize={12} />
									<span className="genre-web-path-name">
										{a.album} <span className="genre-web-path-artist">· {a.artist}</span>
									</span>
									<button
										className="icon-btn genre-web-path-remove"
										onClick={() => removeFromPath(i)}
										aria-label={`Remove ${a.album} from path`}
									>
										<CloseIcon size={11} />
									</button>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
