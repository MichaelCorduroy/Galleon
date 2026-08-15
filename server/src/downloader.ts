import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// matches how scanDirectory is invoked ("../music", resolved against the
// server process's cwd) so downloads land exactly where the scanner looks
const MUSIC_DIR = "../music";

// prefer the project's own venv (set up via `python3 -m venv .venv && .venv/bin/pip
// install -r requirements.txt`) over a bare "yt-dlp" that may not be on PATH,
// e.g. when the server runs under a process manager with a stripped-down PATH
const VENV_YTDLP = path.join(
	__dirname,
	"..",
	".venv",
	process.platform === "win32" ? "Scripts/yt-dlp.exe" : "bin/yt-dlp",
);
const YTDLP_CMD = process.env.YTDLP_PATH || (fs.existsSync(VENV_YTDLP) ? VENV_YTDLP : "yt-dlp");
const COOKIES_FILE = path.join(__dirname, "..", "cookies.txt");

function sanitizeForPath(value: string): string {
	const cleaned = value
		.replace(/[/\\:*?"<>|]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	return cleaned || "Unknown";
}

// yt-dlp's --add-metadata embeds whatever the source (YouTube) calls the
// video — e.g. "Artist - Title [OFFICIAL AUDIO]" as the title, uploader as
// artist — not our canonical artist/album/title. The scanner trusts embedded
// tags over the filename, so left uncorrected the song lands in the library
// mistagged and never links back to the tracklist entry it was downloaded
// for. Force the real tags on afterward with ffmpeg (stream copy, no re-encode).
async function fixMetadata(filePath: string, artist: string, album: string, title: string, position: number): Promise<void> {
	const tmpPath = `${filePath}.tagfix.mp3`;
	const args = [
		"-y",
		"-i",
		filePath,
		"-map",
		"0",
		"-c",
		"copy",
		"-metadata",
		`title=${title}`,
		"-metadata",
		`artist=${artist}`,
		"-metadata",
		`album=${album}`,
		"-metadata",
		`track=${position}`,
		tmpPath,
	];
	await new Promise<void>((resolve, reject) => {
		let proc: ReturnType<typeof spawn>;
		try {
			proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "inherit"] });
		} catch (err) {
			reject(err);
			return;
		}
		proc.on("error", reject);
		proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`))));
	});
	fs.renameSync(tmpPath, filePath);
}

// only one yt-dlp process at a time — keeps things predictable and avoids
// hammering the source concurrently
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
	const run = queue.then(fn, fn);
	queue = run.catch(() => {});
	return run;
}

export interface DownloadResult {
	success: boolean;
	filePath?: string;
	error?: string;
}

export type DownloadJobStatus = "pending" | "downloading" | "success" | "failed";

export interface DownloadJob {
	id: number;
	artist: string;
	album: string;
	title: string;
	status: DownloadJobStatus;
	error?: string;
	startedAt: number;
	finishedAt?: number;
}

// small in-memory ring buffer — jobs are only meant to drive a "what's
// downloading right now" indicator in the UI, not a durable history, so
// there's no need to persist this anywhere
const MAX_JOBS = 50;
let nextJobId = 1;
const jobs: DownloadJob[] = [];

function addJob(artist: string, album: string, title: string): DownloadJob {
	const job: DownloadJob = { id: nextJobId++, artist, album, title, status: "pending", startedAt: Date.now() };
	jobs.unshift(job);
	jobs.length = Math.min(jobs.length, MAX_JOBS);
	return job;
}

export function listDownloadJobs(): DownloadJob[] {
	return jobs;
}

// downloads a single track into music/{Artist} - {Album}/{Artist} - {Album}
// - {NN} {Title}.mp3, matching the existing library's file naming
// convention so the scanner picks it up the same way any other file would
export async function downloadTrack(
	artist: string,
	album: string,
	title: string,
	position: number,
): Promise<DownloadResult> {
	const job = addJob(artist, album, title);

	return serialized(async () => {
		job.status = "downloading";
		const folderName = `${sanitizeForPath(artist)} - ${sanitizeForPath(album)}`;
		const folder = path.join(MUSIC_DIR, folderName);
		fs.mkdirSync(folder, { recursive: true });

		const baseName = `${sanitizeForPath(artist)} - ${sanitizeForPath(album)} - ${String(position).padStart(2, "0")} ${sanitizeForPath(title)}`;
		const outputTemplate = path.join(folder, `${baseName}.%(ext)s`);
		const expectedPath = path.join(folder, `${baseName}.mp3`);

		const args = [
			"--extract-audio",
			"--audio-format",
			"mp3",
			"--audio-quality",
			"0",
			"--embed-thumbnail",
			"--add-metadata",
			"--no-overwrites",
			// newer yt-dlp needs the actual JS challenge-solver script fetched
			// separately from the JS runtime itself (deno) — without this,
			// YouTube's "n"/signature challenges fail and only thumbnail
			// "formats" are left, so extraction errors out
			"--remote-components",
			"ejs:github",
			"--sleep-requests",
			"2",
			"-o",
			outputTemplate,
		];

		if (fs.existsSync(COOKIES_FILE)) {
			args.push("--cookies", COOKIES_FILE);
		}

		args.push(`ytsearch1:${artist} ${title}`);

		const exitCode = await new Promise<number>((resolve) => {
			let proc: ReturnType<typeof spawn>;
			try {
				proc = spawn(YTDLP_CMD, args, { stdio: ["ignore", "inherit", "inherit"] });
			} catch {
				resolve(-1);
				return;
			}
			proc.on("error", () => resolve(-1)); // e.g. yt-dlp not installed / not on PATH
			proc.on("close", (code) => resolve(code ?? -1));
		});

		job.finishedAt = Date.now();

		if (exitCode !== 0) {
			job.status = "failed";
			job.error = `yt-dlp exited with code ${exitCode} (is it installed and on PATH?)`;
			return { success: false, error: job.error };
		}
		if (!fs.existsSync(expectedPath)) {
			job.status = "failed";
			job.error = "yt-dlp reported success but the expected file wasn't found";
			return { success: false, error: job.error };
		}

		try {
			await fixMetadata(expectedPath, artist, album, title, position);
		} catch (err) {
			// the audio file itself is still valid and playable even if tag
			// correction fails (e.g. ffmpeg missing) — don't fail the whole
			// download over it, just log and move on with whatever tags exist
			console.error("Failed to correct ID3 tags after download:", err);
		}

		job.status = "success";
		return { success: true, filePath: expectedPath };
	});
}
