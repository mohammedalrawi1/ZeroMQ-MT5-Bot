class Trade {
  constructor({
    id,
    ticket,
    symbol,
    type,
    price,
    virtualTime,
    executionTime,
    runningTime,
    gap,
    lot,
    margin,
    profit,
    sl,
    timeout,
    news,
    partialClose,
    trailingMinutes,
    state,
  }) {
    this.id = id;
    this.ticket = ticket;
    this.symbol = symbol;
    this.type = type;
    this.price = price;
    this.virtualTime = virtualTime;
    this.executionTime = executionTime;
    this.runningTime = runningTime;
    this.gap = gap;
    // this.volume = volume;
    this.margin = margin;
    this.profit = profit;
    this.sl = sl;
    this.timeout = timeout;
    this.news = news;
    this.partialClose = partialClose;
    this.trailingMinutes = trailingMinutes;
    this.state = state;

    this.update(this);

    // this.build();
  }

  build() {
    this.element = this.parent.element.createE("div", "trade", {
      style: {
        border: "1px solid black",
        padding: "5px",
        // boxSizing: 'border-box',
        margin: "10px",
        display: "flex",
        justifyContent: "space-between",
      },
    });
    this.idElement = this.element.createE("div", "trade-id", this.id);
    this.symbolElement = this.element.createE(
      "div",
      "trade-symbol",
      this.symbol
    );
    this.symbolElement.addEventListener("click", () =>
      fetch(`/partialClose/${this.ticket}`)
    );
    // this.volumeElement = this.element.createE(
    //   "div",
    //   "trade-volume",
    //   this.volume
    // );
    this.closeButton = this.element.createE("div", "close-button", "x");
    this.closeButton.addEventListener("click", () => this.close());
  }

  update(trade) {
    if (trade.state != this.state || !this.parent) {
      if (this.element) this.element.remove();
      switch (trade.state) {
        case "pending":
          this.parent = app.pages.Trades.pendingTradesContainer;
          this.build();
          break;
        case "executed":
          this.parent = app.pages.Trades.executedTradesContainer;
          this.build();
          break;
        case "running":
          this.parent = app.pages.Trades.runningTradesContainer;
          this.build();
          break;
      }
    }
  }

  close() {
    fetch(`/cancel/${this.id}`);
  }
}
