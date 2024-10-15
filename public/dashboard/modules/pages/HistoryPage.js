class HistoryPage extends Page {
  constructor() {
    super();
    this.trades = {};
    this.lastID;
    this.loadingTrades;
  }

  build() {
    this.historyTradesURL = "/history";
    this.element = this.parentElement.createE("div", "page");
    this.built = true;

    this.element.addEventListener("scroll", () => {
      const scrollTop = this.element.scrollTop;
      const scrollHeight = this.element.scrollHeight;
      const height = this.element.offsetHeight;

      if (scrollTop + height >= scrollHeight && !this.loadingTrades) {
        this.loadingTrades = true;
        // User has scrolled to the bottom
        console.log("Scrolled to the bottom!");
        // Load more data or perform any other action
        this.loadTrades().then(() => {
          this.loadingTrades = false;
        });
      }
    });

    this.titleElement = this.element.createE("h1", "page-title", "History");

    this.loadTrades();
  }

  async loadTrades() {
    console.log("loading trades");
    return new Promise((resolve, reject) => {
      fetch(
        this.lastID
          ? `${this.historyTradesURL}/${this.lastID}`
          : this.historyTradesURL
      )
        .then((res) => {
          return res.json();
        })
        .then((data) => {
          console.log(data);
          for (let trade of data) {
            if (trade.id != 1) {
              // console.log(trade);
              this.trades[trade.id] = new HistoryTrade({ parent: this, trade });
              this.lastID = trade.id;
            }
          }
          resolve();
        })
        .catch((err) => reject(err));
    });
  }
}
