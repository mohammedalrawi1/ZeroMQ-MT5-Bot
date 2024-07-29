class HistoryTrade {
  constructor({ parent, trade }) {
    this.parent = parent;
    this.trade = trade;
    this.logs = [];
    let profit = this.trade.profit;
    this.trade.profit = !profit ? 0.0 : profit > 0 ? `+${profit}` : profit;
    this.build();
  }

  build() {
    this.element = this.parent.element.createE("div", "history-trade");

    this.headdingElement = this.element.createE(
      "div",
      "history-trade-headding"
    );

    this.headdingElement.addEventListener("click", () => {
      if (!this.element.className.includes("expanded")) {
        anime({
          targets: this.element,
          height: (e) => {
            let children = e.children;
            let height = 0;
            for (let i = 0; i < children.length; i++) {
              const child = children[i];
              const style = window.getComputedStyle(child);
              let marginTop = parseFloat(style.marginTop);
              let marginBottom = parseFloat(style.marginBottom);
              height += child.offsetHeight + marginTop;
            }
            return height;
          },
          // easing: "easeOutElastic(1, .8)",
          duration: 500,
        });
      } else {
        anime({
          targets: this.element,
          height: (e) => {
            let children = e.children;
            return children[0].offsetHeight;
          },
          // easing: "easeOutElastic(1, .8)",
          duration: 500,
        });
      }
      this.element.classList.toggle("expanded");
    });

    this.idElement = this.headdingElement.createE(
      "h2",
      "history-trade-id-symbol",
      `${this.trade.id} ${this.trade.symbol}`
    );
    this.virtualTimeElement = this.headdingElement.createE(
      "div",
      `history-trade-virtualtime`,
      this.trade.virtualTime.replace("T", " ")
    );
    this.profitElement = this.headdingElement.createE(
      "div",
      `history-trade-profit ${
        !this.trade.profit == 0
          ? this.trade.profit < 0
            ? "negative"
            : "positive"
          : ""
      }`,
      `${this.trade.profit}$`
    );

    this.properitiesContainerElement = this.element.createE(
      "div",
      "history-trade-properities-container"
    );
    this.properitiesElements = {
      volume: new HistoryTradeProperity({
        parent: this,
        title: "Volume",
        value: `${this.trade.volume} lot`,
      }),
      maximumLoss: new HistoryTradeProperity({
        parent: this,
        title: "Maximum Loss",
        value: `${this.trade.maximumLoss}${this.trade.maximumLossType}`,
      }),
      slOffset: new HistoryTradeProperity({
        parent: this,
        title: "SL Offset",
        value: this.trade.slOffset ? `${this.trade.slOffset} %` : "Not set",
      }),
      gap: new HistoryTradeProperity({
        parent: this,
        title: "Gap",
        value: `${this.trade.gap} ${this.trade.gapType}`,
      }),
      timeout: new HistoryTradeProperity({
        parent: this,
        title: "Timeout",
        value: `${this.trade.timeout}s`,
      }),
      partialClose: new HistoryTradeProperity({
        parent: this,
        title: "Partial Close",
        value: `${this.trade.partialClosePercentage}%  |  ${this.trade.partialCloseTarget}${this.trade.partialCloseTargetType}`,
        style: { backgroundColor: this.partiallyClosed ? "#CEEABD" : false },
      }),
      secured: new HistoryTradeProperity({
        parent: this,
        title: "Secured",
        value: this.trade.secured ? "✔" : "✘",
        style: { backgroundColor: this.trade.secured ? "#CEEABD" : "#EABDBD" },
      }),
      state: new HistoryTradeProperity({
        parent: this,
        title: "State",
        value: this.trade.state,
        style: {
          backgroundColor:
            this.trade.state == "completed" || this.trade.state == "timeout"
              ? "#CEEABD"
              : this.trade.state == "pending"
              ? "#F8E894"
              : "#EABDBD",
        },
      }),
      doubleRisk: new HistoryTradeProperity({
        parent: this,
        title: "Double Risk",
        value: this.trade.doubleRisk,
        // style: this.trade.doubleRiskPosition.hasProperity("ticket")
        //   ? "#CEEABD"
        //   : "#F8E894",
      }),
    };

    this.logsHeadderElement = this.element.createE(
      "h3",
      "history-trade-logs-headder",
      "Logs"
    );

    this.logsHeadderElement.addEventListener("click", () => {
      if (!this.logsContainerElement.className.includes("expanded")) {
        anime({
          targets: this.logsContainerElement,
          height: (e) => {
            let children = e.children;
            let height = 0;
            for (let i = 0; i < children.length; i++) {
              const child = children[i];
              const style = window.getComputedStyle(child);
              let marginTop = parseFloat(style.marginTop);
              let marginBottom = parseFloat(style.marginBottom);
              height += child.offsetHeight + marginTop;
            }
            return height;
          },
          // easing: "easeOutElastic(1, .8)",
          duration: 500,
        });
      } else {
        anime({
          targets: this.logsContainerElement,
          height: 0,
          // easing: "easeOutElastic(1, .8)",
          duration: 500,
        });
      }
      this.logsContainerElement.classList.toggle("expanded");
    });

    this.logsContainerElement = this.element.createE(
      "div",
      "history-trade-logs-container"
    );

    for (let log of this.trade.logs) {
      this.logs.push(new HistoryTradeLog({ parent: this, log }));
    }

    this.logsContainerElement.style.height = "0px";
    // console.log(containerHeight);
    // this.logsContainerElement.style.height = "0px";
  }
}

class HistoryTradeProperity {
  constructor({ parent, title, value, style }) {
    this.parent = parent;
    this.title = title;
    this.value = value;
    this.style = style;
    this.build();
  }

  build() {
    this.element = this.parent.properitiesContainerElement.createE(
      "div",
      "history-trade-properity"
    );
    this.titleElement = this.element.createE(
      "div",
      "history-trade-properity-title",
      this.title,
      { style: this.style }
    );
    this.valueElement = this.element.createE(
      "div",
      "history-trade-properity-value",
      this.value
    );
  }
}

class HistoryTradeLog {
  constructor({ parent, log }) {
    this.parent = parent;
    this.time = log.time;
    this.msg = log.msg;
    this.err = log.err;
    this.build();
  }

  build() {
    this.element = this.parent.logsContainerElement.createE(
      "div",
      "history-trade-log-container"
    );
    this.timeElement = this.element.createE(
      "div",
      "history-trade-log-time",
      this.time.replace("T", " ").replace(/\..+?Z/g, "")
    );
    this.msgElement = this.element.createE(
      "div",
      "history-trade-log-msg",
      this.msg
    );
    this.errElement = this.element.createE(
      "div",
      "history-trade-log-err",
      this.err ? this.err.error : ""
    );
    this.errMsgElement = this.element.createE(
      "div",
      "history-trade-log-err-msg",
      this.err ? this.err.message : ""
    );
  }
}
