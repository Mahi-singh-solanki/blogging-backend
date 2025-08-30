const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const body_parser = require("body-parser");

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(body_parser.json());

const { router: authRoutes, authenticateJWT } = require("./auth");
const { router: blogRoutes } = require("./blog");
const { router: adminRoutes } = require("./admin");
app.use(authRoutes);
app.use(blogRoutes);
app.use(adminRoutes);

mongoose.connect(
  "mongodb+srv://mahipalsinghapsit0:msdonrajputana@cluster0.am95irj.mongodb.net/blog",
  { useNewUrlParser: true, useUnifiedTopology: true }
);

app.listen(8080, () => {
  console.log("Server running on http://localhost:8080");
});
