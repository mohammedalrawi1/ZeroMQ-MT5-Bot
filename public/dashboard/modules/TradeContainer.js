class TradeContainer {
  constructor(title, parent) {
    this.title = title;
    this.parent = parent;
    this.trades = {};

    this.build();
  }

  build() {
    this.element = this.parent.element.createE("div", "trade-container", {
      style: {},
    });
    this.titleElement = this.element.createE(
      "h1",
      "container-title",
      this.title
    );
  }

  async updateTrade(trade) {
    // for (let i = 0; i < trades.length; i++) {
    // const trade = trades[i];
    if (this.trades[trade.id].element) return;
    this.addTrade(trade);
    // }
  }

  addTrade(tradeObj) {
    this.trades[tradeObj.id] = new Trade(this, {
      id: tradeObj.id,
      symbol: tradeObj.symbol,
      ticket: tradeObj.ticket,
    });
  }

  removeTrade(id) {
    let tradeIndex = this.trades.findIndex((trade) => trade.id == id);
    this.trades.splice(tradeIndex, 1);
  }
}
