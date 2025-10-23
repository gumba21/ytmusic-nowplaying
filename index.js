import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();

// allow requests from YouTube Music (or use "*" if you prefer)
app.use(cors({
  origin: "https://music.youtube.com",
  methods: ["POST", "GET"],
  allowedHeaders: ["Content-Type"],
}));

app.use(bodyParser.json());

let nowPlaying = "nothing playing :[";

// show it on the web page
app.get("/", (req, res) => {
  res.send(`
    <style>
      body {
        font-family: sans-serif;
        text-align: center;
        background: #111;
        color: #fff;
        font-size: 1.5em;
        margin-top: 20vh;
    </style>
    <div>🎵 now playing: ${nowPlaying}</div>
  `);
});

// receive updates from your userscript
app.post("/update", (req, res) => {
  const { title, artist } = req.body;
  nowPlaying = `${title} - ${artist}`;
  console.log("updated:", nowPlaying);
  res.sendStatus(200);
});

app.listen(3000, () => console.log("ready on port 3000"));
