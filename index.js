import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
app.use(bodyParser.json());

// store connections here
let clients = [];
let nowPlaying = "nothing playing :[";

// serve main live-updating page
app.get("/", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("Access-Control-Allow-Origin", "*");
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Now Playing</title>
      <style>
        body {
          font-family: sans-serif;
          text-align: center;
          background: #111;
          color: #fff;
          font-size: 1.5em;
          margin-top: 20vh;
        }
        #song {
          transition: opacity 0.3s ease;
        }
      </style>
    </head>
    <body>
      <div id="song">🎵 now playing: ${nowPlaying}</div>
      <script>
        const song = document.getElementById("song");
        const source = new EventSource("/events");
        source.onmessage = (event) => {
          song.style.opacity = 0;
          setTimeout(() => {
            song.textContent = "🎵 now playing: " + event.data;
            song.style.opacity = 1;
          }, 300);
        };
      </script>
    </body>
    </html>
  `);
});

// SSE endpoint (keeps connection open)
app.get("/events", (req, res) => {
  res.set({
    "Cache-Control": "no-store",
    "Content-Type": "text/event-stream",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*"
  });

  res.write(`data: ${nowPlaying}\n\n`);
  clients.push(res);

  // remove client when it disconnects
  req.on("close", () => {
    clients = clients.filter(c => c !== res);
  });
});

// open to everyone for reading json
app.get("/json", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("Access-Control-Allow-Origin", "*");
  res.json({ nowPlaying });
});

// restrict /update to YouTube Music only
app.use(
  "/update",
  cors({
    origin: "https://music.youtube.com",
    methods: ["POST"],
    allowedHeaders: ["Content-Type"],
  })
);

// update song + notify all viewers
app.post("/update", (req, res) => {
  const { title, artist } = req.body;
  nowPlaying = `${title} - ${artist}`;
  console.log("updated:", nowPlaying);

  // send update to every connected client
  for (const client of clients) {
    client.write(`data: ${nowPlaying}\n\n`);
  }

  res.sendStatus(200);
});

app.listen(3000, () => console.log("ready on port 3000"));
