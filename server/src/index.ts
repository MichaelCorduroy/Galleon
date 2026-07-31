import Fastify from "fastify";
import {scanDirectory} from "./scanner";
import fs from "node:fs";
import db from "./database";

const app = Fastify();
import cors from "@fastify/cors";


async function start() {
	

await app.register(cors, {
	origin: true 
});



app.get("/scan", async () => {
	//Replace path with where you store your music 
	const songs = await scanDirectory("../music");
	return songs;
});

app.get("/songs", async () => {
	const songs = db.prepare('SELECT id, title, artist, album, duration FROM songs').all();
	return songs;
});


app.get("/stream/:id", async (request, reply) => {
	const { id } = request.params as { id: string };

	const song = db.prepare(`SELECT path FROM songs WHERE id = ?`).get(id) as
		{ path: string } | undefined;

	if (!song) {
		return reply.code(404).send("Song not found");
	}

	const stream = fs.createReadStream(song.path);
	reply.type("audio/mpeg");
	return reply.send(stream);
});

app.get("/albums", async () => {
	const albums = db.prepare('SELECT album, artist, COUNT(*) as tracks FROM songs GROUP BY album, artist').all();
	return albums;
});

app..get("/health", async () => {
	return  {
		status: "ok",
		service: "Galleon",
	};
});


app.listen({
	port: 3000,
	host: "0.0.0.0",
}).then((address) => {
	console.log(`Server listening at ${address}`);
});

}

start();

// to run server 
// npx tsx src/index.ts
