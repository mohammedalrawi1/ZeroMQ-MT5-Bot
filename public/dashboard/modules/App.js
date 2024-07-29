class App {
  constructor(username, parent) {
    this.username = username;
    this.parent = parent;

    this.pages = {};
    this.trades = {};

    this.init();
  }

  init() {}

  connectStatusUpdate(connection) {
    console.log("status changed");
    if (connection == true) {
      this.navBar.onlineStatus.className = "online";
    } else if (connection == false) {
      this.navBar.onlineStatus.className = "offline";
    }
  }

  build() {
    this.element = this.parent.createE("div", "#app");

    this.navBar = new NavBar(this.element);

    this.pageContainer = this.element.createE("div", "#page-container", {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        backgroundColor: "#fbfafa",
      },
    });

    this.navBar.buttons.forEach((b) => b.createPage(this.pageContainer));

    this.getTrades();
  }

  async getTrades() {
    let res = await fetch("/mt");
    res = await res.json();
    let trades = res.trades;
    for (let trade in trades) {
      this.updateTrade(trades[trade]);
    }
  }

  updateTrade(trade) {
    console.log(trade);
    if (!this.trades[trade.id]) {
      this.trades[trade.id] = new Trade(trade);
    } else {
      this.trades[trade.id].update(trade);
    }
  }
}
