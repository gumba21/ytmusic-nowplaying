import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
app.use(bodyParser.json());

// store connections here
let clients = [];

// store current song info here (so we can do svg + json)
let nowPlaying = {
  title: "",
  artist: "",
  cover: "",
  url: "",
};

function currentLine() {
  return (nowPlaying.title && nowPlaying.artist)
    ? `${nowPlaying.title} - ${nowPlaying.artist}`
    : "nothing playing :[";
}

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// serve main live-updating page
app.get("/", (req, res) => {
  const line = currentLine();

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
        img {
          margin-top: 16px;
          width: 160px;
          height: 160px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.2);
          object-fit: cover;
        }
        a { color: #8ecbff; }
      </style>
    </head>
    <body>
      <div id="song">🎵 now playing: ${esc(line)}</div>
      ${nowPlaying.cover ? `<img id="cover" src="${esc(nowPlaying.cover)}" alt="cover" />` : `<div id="coverwrap"></div>`}
      ${nowPlaying.url ? `<div style="margin-top:10px;font-size:14px;opacity:.85;"><a id="link" href="${esc(nowPlaying.url)}" target="_blank">open track</a></div>` : `<div id="linkwrap"></div>`}

      <script>
        const song = document.getElementById("song");
        const cover = document.getElementById("cover");
        const link = document.getElementById("link");

        const source = new EventSource("/events");
        source.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            song.style.opacity = 0;
            setTimeout(() => {
              const line = (data.title && data.artist) ? (data.title + " - " + data.artist) : "nothing playing :[";
              song.textContent = "🎵 now playing: " + line;
              song.style.opacity = 1;

              // cover
              if (data.cover) {
                if (cover) {
                  cover.src = data.cover;
                } else {
                  const img = document.createElement("img");
                  img.id = "cover";
                  img.alt = "cover";
                  img.src = data.cover;
                  document.body.appendChild(img);
                }
              }

              // link
              if (data.url) {
                if (link) {
                  link.href = data.url;
                } else {
                  const div = document.createElement("div");
                  div.style.marginTop = "10px";
                  div.style.fontSize = "14px";
                  div.style.opacity = ".85";
                  div.innerHTML = '<a id="link" target="_blank" style="color:#8ecbff;" href="' + data.url + '">open track</a>';
                  document.body.appendChild(div);
                }
              }
            }, 300);
          } catch (e) {
            // fallback if something weird happens
            song.textContent = "🎵 now playing: " + event.data;
          }
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
    "Access-Control-Allow-Origin": "*",
  });

  // send initial state
  res.write(`data: ${JSON.stringify(nowPlaying)}\n\n`);
  clients.push(res);

  // remove client when it disconnects
  req.on("close", () => {
    clients = clients.filter((c) => c !== res);
  });
});

// open to everyone for reading json
app.get("/json", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("Access-Control-Allow-Origin", "*");
  res.json(nowPlaying);
});

// spacehey-friendly image endpoint
app.get("/nowplaying.svg", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.type("image/svg+xml");

  const title = nowPlaying.title || "nothing playing";
  const artist = nowPlaying.artist || "";
  const cover = nowPlaying.cover || "";

  const w = 340;
  const h = 90;

  // cover inside svg might not load sometimes due to hotlink/cors.
  // text will always work though.
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="rgba(255,255,255,0.12)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0.05)"/>
    </linearGradient>
  </defs>

  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="14"
        fill="url(#bg)" stroke="rgba(255,255,255,0.25)"/>

  <text x="14" y="18" font-family="Verdana, Arial, sans-serif" font-size="11"
        fill="rgba(255,255,255,0.80)">now playing</text>

  ${cover ? `
    <image x="14" y="28" width="50" height="50" href="${esc(cover)}" preserveAspectRatio="xMidYMid slice"/>
    <rect x="14" y="28" width="50" height="50" rx="10" fill="none" stroke="rgba(255,255,255,0.18)"/>
  ` : `
    <rect x="14" y="28" width="50" height="50" rx="10" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)"/>
  `}

  <text x="74" y="52" font-family="Verdana, Arial, sans-serif" font-size="13" fill="#fff">
    ${esc(title)}
  </text>
  <text x="74" y="72" font-family="Verdana, Arial, sans-serif" font-size="11" fill="rgba(255,255,255,0.78)">
    ${esc(artist)}
  </text>
</svg>`;

  res.send(svg);
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
  const { title = "", artist = "", cover = "", url = "" } = req.body || {};

  nowPlaying = {
    title: String(title).slice(0, 120),
    artist: String(artist).slice(0, 120),
    cover: String(cover).slice(0, 5000),
    url: String(url).slice(0, 5000),
  };

  console.log("updated:", currentLine());

  // send update to every connected client
  const payload = JSON.stringify(nowPlaying);
  for (const client of clients) {
    client.write(`data: ${payload}\n\n`);
  }

  res.sendStatus(200);
});

app.listen(3000, () => console.log("ready on port 3000"));
