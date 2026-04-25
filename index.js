const express = require("express");

const app = express();

app.get("/", (req, res) => {
  res.send("Dein Bot-Hosting Server läuft 🚀");
});

app.listen(3000, () => {
  console.log("Server läuft auf Port 3000");
});