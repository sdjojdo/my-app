const express = require("express");
const multer = require("multer");
const AdmZip = require("adm-zip");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({ dest: "uploads/" });

const botsDir = path.join(__dirname, "bots");
if (!fs.existsSync(botsDir)) fs.mkdirSync(botsDir);

let bots = {};

app.use(express.static("public"));
app.use(express.json());

app.post("/upload", upload.single("botzip"), async (req, res) => {
  try {
    const botId = Date.now().toString();
    const botPath = path.join(botsDir, botId);
    fs.mkdirSync(botPath);

    const zip = new AdmZip(req.file.path);
    zip.extractAllTo(botPath, true);

    fs.unlinkSync(req.file.path);

    const packagePath = path.join(botPath, "package.json");

    if (!fs.existsSync(packagePath)) {
      return res.status(400).json({ error: "Keine package.json gefunden." });
    }

    bots[botId] = {
      id: botId,
      path: botPath,
      status: "installing",
      logs: ["Bot hochgeladen.", "npm install startet..."],
      process: null
    };

    const install = spawn("npm", ["install"], {
      cwd: botPath,
      shell: true
    });

    install.stdout.on("data", data => {
      bots[botId].logs.push(data.toString());
    });

    install.stderr.on("data", data => {
      bots[botId].logs.push(data.toString());
    });

    install.on("close", code => {
      if (code !== 0) {
        bots[botId].status = "install_failed";
        bots[botId].logs.push("npm install fehlgeschlagen.");
        return;
      }

      bots[botId].status = "running";
      bots[botId].logs.push("npm install fertig.");
      bots[botId].logs.push("Bot startet...");

      const botProcess = spawn("npm", ["start"], {
        cwd: botPath,
        shell: true
      });

      bots[botId].process = botProcess;

      botProcess.stdout.on("data", data => {
        bots[botId].logs.push(data.toString());
      });

      botProcess.stderr.on("data", data => {
        bots[botId].logs.push(data.toString());
      });

      botProcess.on("close", code => {
        bots[botId].status = "stopped";
        bots[botId].logs.push("Bot gestoppt mit Code: " + code);
      });
    });

    res.json({ success: true, botId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/bots", (req, res) => {
  const list = Object.values(bots).map(bot => ({
    id: bot.id,
    status: bot.status
  }));

  res.json(list);
});

app.get("/logs/:id", (req, res) => {
  const bot = bots[req.params.id];

  if (!bot) {
    return res.status(404).json({ error: "Bot nicht gefunden." });
  }

  res.json({
    status: bot.status,
    logs: bot.logs
  });
});

app.post("/stop/:id", (req, res) => {
  const bot = bots[req.params.id];

  if (!bot) {
    return res.status(404).json({ error: "Bot nicht gefunden." });
  }

  if (bot.process) {
    bot.process.kill();
    bot.status = "stopped";
    bot.logs.push("Bot manuell gestoppt.");
  }

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log("Bot-Hosting Server läuft auf Port " + PORT);
});
