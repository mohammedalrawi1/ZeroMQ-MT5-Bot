class HistoryPage extends Page {
  constructor() {
    super();
    this.trades = {};
  }

  build() {
    this.historyTradesURL = "/history";
    this.element = this.parentElement.createE("div", "page");
    this.built = true;

    this.titleElement = this.element.createE("h1", "page-title", "History");

    fetch(this.historyTradesURL)
      .then((res) => {
        return res.json();
      })
      .then((data) => {
        console.log(data);
        for (let trade of data) {
          if (trade.id != 1) {
            console.log(trade);
            this.trades[trade.id] = new HistoryTrade({ parent: this, trade });
          }
        }
      });
  }
}
