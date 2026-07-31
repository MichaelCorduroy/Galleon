import Fastify from "fastify";
import {scanDirectory} from "./scanner";
import db from "./database";

const app = Fastify();


app.get("/scan", async () => {
	//Replace path with where you store your music 
	const songs = await scanDirectory("../music");
	return songs;
});

app.get("/songs", async () => {
	const songs = db.prepare('SELECT id, title, artist, album, duration FROM songs').all();
	return songs;
});


app.listen({
	port: 3000,
	host: "0.0.0.0",
}).then((address) => {
	console.log(`Server listening at ${address}`);
});


// to run server 
// npx tsx src/index.ts
