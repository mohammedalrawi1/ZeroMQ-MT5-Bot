// for scaping the news to open it in the browser
const NewsScraper = require("./NewsScraper.js");
let newsScraper = new NewsScraper();
// const flatted = require("flatted");
const CircularJSON = require("circular-json");

// for hashing the passwords when registering a new account
const bcrypt = require("bcrypt");

const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
const path = require("path");

// mongodb
const mongoDBuri = "mongodb://127.0.0.1:27017";
const databaseName = "trading";
const MongoDB = require("./MongoDB.js");
let db = new MongoDB(databaseName, mongoDBuri);

// mongodb sessions
const MongoDBStore = require("connect-mongodb-session")(session);
let store = new MongoDBStore({
  uri: mongoDBuri,
  databaseName,
  collection: "sessions",
});
store.on("error", (err) => console.error);
app.use(
  session({
    secret: "uuidcode",
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    },
  })
);

// for interacting with the metaapi.cloud
const Bot = require("./Bot.js");
let bot;

const socketIo = require("socket.io");

// paths defining
const loginStaticFolder = "public/login";
const dashboardStaticFolder = "public/dashboard";

app.get("/news", isAuthMW, async (req, res) => {
  try {
    let news = await newsScraper.getNews();
    res.json(news);
  } catch (err) {
    console.log(err);
    res.sendStatus(404);
  }

  // let news = newsScraper
  //   .getNews()
  //   .then((result) => {
  //     res.json(result);
  //   })
  //   .catch((error) => {
  //     console.log({ newsError: error });
  //     res.sendStatus(404);
  //   });
});

app.get("/history/:id?", isAuthMW, async (req, res) => {
  let historyTrades;
  if (req.params.id) {
    historyTrades = await db.readLimit("trades", {
      id: { $lt: parseInt(req.params.id) },
    });
  } else {
    historyTrades = await db.readLimit("trades");
  }
  res.json(historyTrades);
});

app.post("/trade", isAuthMW, async (req, res) => {
  try {
    let trade = await bot.newTrade(req.body);
    res.json({ status: "ok" });
  } catch (err) {
    console.log(err);
    res.sendStatus(400);
  }
});

app.get("/cancel/:id", isAuthMW, async (req, res) => {
  // needs to be re-written so if the trade is opened, it will be closed.
  // and if the trade is not opened yet, it will be canceled
  // it may be better written with sockets
  let id = parseInt(req.params.id);
  // // db.update("trades", { id }, { state: "canceled" });
  if (bot.trades[id]) {
    await bot.trades[id].close();
  }
  res.sendStatus(200);
});

app.get("/partialClose/:ticket", isAuthMW, async (req, res) => {
  // needs to be re-written so if the trade is opened, it will be closed.
  // and if the trade is not opened yet, it will be canceled
  // it may be better written with sockets
  let ticket = parseInt(req.params.ticket);
  // // db.update("trades", { id }, { state: "canceled" });
  await bot.mt.partialClose({
    ticket: ticket,
    percentage: 0.2,
  });
  res.sendStatus(200);
});

app.use("/dashboard", isAuthMW, express.static(dashboardStaticFolder));

app.use("/mt", isAuthMW, (req, res) => {
  res.json(JSON.parse(CircularJSON.stringify(bot)));
  return;
});

// registering a new account
app.post("/register", isAuthMW, async (req, res) => {
  let { username, password } = req.body;
  try {
    // Generate a salt
    const salt = await bcrypt.genSalt(10);

    // Hash the password along with the salt
    const hashedPassword = await bcrypt.hash(password, salt);

    // Store the hashed password in your database
    await db.create("users", { username, password: hashedPassword });

    // create a session
    req.session.username = username;

    res.status(201).send("User registered successfully.");
  } catch (error) {
    console.error("Error registering user:", error);
  }
});

// login page
app.post("/login", async (req, res) => {
  if (req.session.isAuth) {
    res.redirect("/dashboard");
  }
  let { username, password } = req.body;

  try {
    let user = await db.read("users", { username });
    if (!user.length) {
      res.status(401).send("User not found.");
      return;
    } else {
      user = user[0];
    }

    let passwordsMatch = await bcrypt.compare(password, user.password);
    if (passwordsMatch) {
      //create a session
      req.session.isAuth = true;
      req.session.username = username;

      res.redirect("/dashboard");
    } else {
      res.status(401).send("Incorrect password.");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while logging in.");
  }
});

// logout account and remove session
app.use("/logout", isAuthMW, async (req, res) => {
  console.log(req.session);
  let _id = req.session.id;
  console.log(`removing: ${_id}`);
  await db.delete("sessions", { _id });
  res.redirect("/");
});

app.get("/cache_manifest", (req, res) => {
  res.header("Content-Type", "text/cache-manifest");
  console.log(
    path.join(__dirname, "public", "dashboard", "assets", "manifest.json")
  );
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "dashboard",
      "assets",
      "manifest.webmanifest"
    )
  );
});

app.use(
  "/.well-known",
  (req, res, next) => {
    console.log(req.url);
    // let root = "C://nginx/html/.well-known";
    next();

    // res.sendFile(`${root}${req.url}`, {
    //   headers: {
    //     'Content-Type': 'application/octet-stream',
    //     'Content-Disposition': `attachment; filename="${req.url.replace(/^.*\//g, "")}"`
    //   }
    // });
  },
  express.static("C://nginx/html/.well-known", { dotfiles: "allow" })
);

// redirecting users to the proper path
app.use(
  "/",
  async (req, res, next) => {
    if (await isAuth(req)) {
      res.redirect("/dashboard");
    } else {
      console.log("main page");
      next();
    }
  },
  express.static(loginStaticFolder)
);

// middleware to check if the user is already signed in
async function isAuth(req) {
  console.log("authentication . . .", req.url);

  let id = req.session.id;
  let dbUser = await db.read("sessions", { _id: id });

  if (!dbUser.length) {
    return false;
  }

  let username = req.session.username;
  let dbUsername = dbUser[0].session.username;

  if (id == dbUser[0]._id && username == dbUsername) {
    return true;
  } else {
    return false;
  }
}
async function isAuthMW(req, res, next) {
  if (await isAuth(req)) {
    // bot.mt.updateMetaData();
    next();
  } else {
    console.log("redirecting to the login page");
    res.redirect("/");
  }
}

const io = socketIo(
  app.listen(3500, () => {
    console.log("server is running on port: 3500");
    bot = new Bot({});
  })
);

io.on("connection", (socket) => {
  console.log("a user connected"); // this is shown correctly

  bot.emitter.on("brokerConnection", (connection) => {
    // this is done in both
    socket.emit("brokerConnection", connection);
  });

  bot.emitter.on("accountInformation", (accountInformation) => {
    // this is done in the both server and client-side
    socket.emit("accountInformation", accountInformation);
  });

  bot.emitter.on("positionUpdate", (trade) => {
    socket.emit("positionUpdate", trade);
  });

  bot.emitter.on("tradeClose", (trade) => {
    socket.emit("tradeClose", trade);
  });

  // bot.emitter.on("symbol specification update", (specification) => {
  // 	// only in back-end
  // 	// this should be done in bot.js only
  // 	socket.emit("symbol specification update", specification);
  // });

  bot.emitter.on("symbolPriceUpdate", (price) => {
    socket.emit("symbolPriceUpdate", price);
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected"); // this is shown correctly
  });
});

// for testing purposes
app.post("/timecheck", (req, res) => {
  let reqMinutes = new Date(req.body.time).getTime() / 1000 / 60;
  let now = new Date().getTime() / 1000 / 60;
  console.log(reqMinutes);

  res.send({
    timeDifference: now - reqMinutes,
  });
});
