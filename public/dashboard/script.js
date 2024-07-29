let body = document.body;

const username = "mohammedalrawi";

let app = new App(username, body);
app.init();
app.build();
let socket = io();

socket.on("connect", (status) => {
  console.log("connected");
});

socket.on("brokerConnection", (connection) => {
  app.connectStatusUpdate(connection);
  console.log("broker connection");
  console.log(connection);
});

socket.on("informationUpdate", (accountInformation) => {
  console.log("information update");
  console.log(accountInformation);
});

socket.on("positionUpdate", (trade) => {
  app.updateTrade(trade);
});

socket.on("tradeClose", (trade) => {
  console.log("trade close");
  app.trades[trade.id].element.remove();
});

socket.on("symbolPriceUpdate", (price) => {
  // console.log("symbol price update");
  // console.log(price);
});
