const MT = require("./MT.js");
const MongoDB = require("./MongoDB.js");
let db = new MongoDB("trading", "mongodb://127.0.0.1:27017");
const schedule = require("node-schedule");
const EventEmitter = require("events");
const CircularJSON = require("circular-json");

class Bot {
  constructor(mt) {
    this.mt = new MT({});
    this.emitter = new EventEmitter();
    this.init();
    this.setDefualtSettings();
    setTimeout(() => {
      this.mt.updateMetaData();
    }, 5000);
    this.trades = {};
    this.reopenPendingTrades();
  }

  async init() {
    this.mt.emitter.on("metadataChange", (res) => {
      let metadata = res.res;
      this.updateMetaData(metadata);
    });
  }

  async updateMetaData(metadata) {
    await db.update("metadata", { username: "mohammedalrawi" }, metadata);
    await db.update(
      "metadata",
      { username: "mohammedalrawi" },
      { lastUpdated: this.currentDate() }
    );
    return true;
  }

  async symbolSubscribe({ symbol }) {
    return this.mt.symbolSubscribe({ symbol });
  }

  async symbolUnsubscribe({ symbol }) {
    return this.mt.symbolUnsubscribe({ symbol });
  }

  async setDefualtSettings() {
    let userMetadata = await db.read("metadata", {
      username: "mohammedalrawi",
    });
    this.defaultSettings = userMetadata[0].defaultSettings;
  }

  async newTrade(argsObj) {
    let trade = new Trade({ ...argsObj, bot: this });
    await trade.changeState("pending");
    // this.emitter.emit("updatePosition", trade);
    try {
      await trade.init();
      this.trades[trade.id] = trade;
      return trade;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  emit(trigger, message) {
    this.emitter.emit(trigger, message);
  }

  currentDate() {
    let date = new Date();
    let newdate = date.setHours(date.getHours() + 3);
    return new Date(newdate);
  }

  async reopenPendingTrades() {
    let oldPendingTrades = await db.read("trades", { state: "pending" });
    for (let i = 0; i < oldPendingTrades.length; i++) {
      const trade = oldPendingTrades[i];
      this.newTrade(trade);
    }
  }
}

class Trade {
  #bot;
  #initData;
  constructor(args) {
    args.logs = [];
    let { bot, ...initArgs } = args;
    this.#bot = bot;
    this.#initData = initArgs;
    for (let key in initArgs) {
      if (args.hasOwnProperty(key)) {
        if (typeof args[key] == "string" && args[key] == "") {
          // setting undefined values with default settings
          args[key] = args.bot.defaultSettings[key];
        } else {
          this[key] = args[key];
        }
      }
    }

    this.virtualTime = new Date(this.virtualTime);
  }

  async changeState(state) {
    let defaultStates = [
      "pending",
      "executed",
      "timeout",
      "rejected",
      "running",
      "completed",
      "canceled",
    ];
    if (defaultStates.includes(state)) {
      this.state = state;
      if (state != "pending")
        await this.updateLogs({
          msg: `State has been changed to ${this.state}`,
        });
    } else {
      console.error("the state is not verfied");
    }
  }

  async init() {
    // TODO: check all the states, so it works fine

    try {
      await this.changeState("pending");
      if (!this.id) {
        let createdData = await db.create(
          "trades",
          { ...this.#initData, state: this.state },
          true
        );
        this.id = createdData;
      }
    } catch (err) {
      console.log(err);
      throw err;
    }
    await this.updateLogs({ msg: `Trade has been initialized.` });
    this.startTimer();
  }

  async subscribeToMarketData(time) {
    if (time === "NOW") {
      await this.#bot.symbolSubscribe({ symbol: this.symbol });
    } else if (time) {
      schedule.scheduleJob(time, async () => {
        try {
          await this.#bot.symbolSubscribe({ symbol: this.symbol });
          console.log(`price subscription (${this.symbol}) started: `);
        } catch (err) {
          console.error(
            `couldn't subscribe to (${this.symbol}) price because: `
          );
          console.error(err);
          await this.updateLogs({
            msg: `Couldn't subscribe to market data.`,
            err,
          });
          await this.close("rejected");
        }
      });
    }
    await this.updateLogs({ msg: `Subscribed to market data.` });
  }

  async startTimer() {
    if (!this.virtualTime) {
      await this.close("rejected");
      await this.updateLogs({ msg: `Invalid time.` });
    }

    this.buyPosition = new Position({
      trade: this,
      type: "POSITION_TYPE_BUY",
      bot: this.#bot,
    });
    this.sellPosition = new Position({
      trade: this,
      type: "POSITION_TYPE_SELL",
      bot: this.#bot,
    });

    this.buyPosition.assignOppositePosition(this.sellPosition);
    this.sellPosition.assignOppositePosition(this.buyPosition);

    // need to check if the time sent by the client is in the past 1 minutes, to immedietly initilize the trade and execute it
    // otherwise, if the time has past more than 1 minutes, the trade would be rejected with an error
    let minDiff =
      new Date(this.virtualTime).getTime() / 1000 / 60 -
      new Date().getTime() / 1000 / 60;
    if (minDiff > -1 && minDiff < 0) {
      await this.updateLogs({ msg: `Immediate execution.` });
      this.virtualTime = this.#bot.currentDate();
      await this.subscribeToMarketData("NOW");
      await this.execute();
    } else if (minDiff < -1) {
      await this.updateLogs({ msg: `Old time.` });
      await this.close("rejected");
      return;
    } else {
      await this.updateLogs({ msg: `Regular time.` });
      await this.subscribeToMarketData(this.virtualTime.getTime() - 15000);
      schedule.scheduleJob(
        this.virtualTime.getTime() - 2000,
        async () => await this.execute()
      );
      // await this.#bot.symbolUnsubscribe(this.virtualTime.getTime() + 10000);
      await this.updateLogs({ msg: `Symbol unsubscribed.` });
    }
    this.timeoutTimer = schedule.scheduleJob(
      this.virtualTime.getTime() + this.timeout * 1000,
      async () => {
        await this.updateLogs({ msg: `Timeout hit.` });
        try {
          // TODO: checking if the code below still works with sockets
          if (this.state == "canceled") return;
          await this.close("timeout");
        } catch (err) {
          console.error("couldn't stop by timeout because: ");
          console.error(err);
        }
      }
    );
    return;
  }

  async updateDB() {
    let newData = this.filter();
    await db.update("trades", { id: this.id }, newData);
    return;
  }

  filter() {
    let obj = JSON.parse(CircularJSON.stringify(this));
    let keys = ["calculatedGap", "timeoutTimer", "logs", "_id"];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      obj.hasOwnProperty(key) ? delete obj[key] : null;
    }
    return obj;
  }

  async updateLogs({ err, msg }) {
    console.log({ err, msg });
    let data = await db.read("trades", { id: this.id });
    let time = this.#bot.currentDate();
    let newData = { time, err, msg };
    data[0].logs.push(newData);
    this.logs = data[0];
    await db.update("trades", { id: this.id }, data[0]);
    return;
  }

  // execute the trade, and make it a pending order
  async execute() {
    await this.calculateVolume();
    try {
      let buy = await this.buyPosition.execute(
        this.#bot.mt.subscribedSymbols[this.symbol]
      );
      let sell = await this.sellPosition.execute(
        this.#bot.mt.subscribedSymbols[this.symbol]
      );

      await this.changeState("executed");

      // TODO: instead of "this.checkPosition", there should be linked to the events
      // Checking positions to remove the opposite when the first one is placed,
      // and to update stoploss
      this.checkPositions();

      // this.executionTime = this.#bot.currentDate();

      return;
    } catch (err) {
      console.log("error has happened while executing a trade!: ", err);
      await this.updateLogs({
        msg: `error has happened while executing a trade!`,
        err,
      });
      await this.close("rejected");
      // throw err;
    }
  }

  async checkPositions() {
    this.buyPosition.check();
    this.sellPosition.check();
  }

  async close(state) {
    await this.updateDB();
    if (state && this.state != "canceled") {
      await this.changeState(state);
    }
    try {
      await this.buyPosition.close();
      await this.sellPosition.close();
      await this.doubleRiskPosition.close();
    } catch (err) {
      // console.log(`couldn't close the trade because of: `);
      // console.error(err);
      await this.updateLogs({ msg: `Couldn't close the trade.`, err });
    }

    if (this.timeoutTimer) this.timeoutTimer.cancel();
    else if (this.trackingTimer) this.trackingTimer.cancel();

    await this.updateLogs({ msg: `Trade has been closed.` });
    await this.updateDB();
    this.#bot.emitter.emit("tradeClose", this.filter());
    delete this.#bot.trades[this.id];
    return;
  }

  async doubleRisking(type) {
    this.doubleRiskPosition = new Position({
      trade: this,
      type,
      bot: this.#bot,
    });
    if (type == "POSITION_TYPE_BUY") {
      await this.doubleRiskPosition.execute("now", this.sellPosition.openPrice);
    } else if (type == "POSITION_TYPE_SELL") {
      await this.doubleRiskPosition.execute("now", this.buyPosition.openPrice);
    }

    await this.doubleRiskPosition.track();
    await this.doubleRiskPosition.check();
  }

  // calculate gaps in pips
  async gapCalculate() {
    // this.calculatedGap = 1;
    // return 1;
    if (this.gapType == "pips") {
      let { tickSize } = await this.#bot.mt.getSymbolSpecifications({
        symbol: this.symbol,
      });

      this.calculatedGap = this.gap * tickSize;
    } else if (this.gapType == "average") {
      // TODO: getting the candle average of 30 minutes and multiplies it with the gap value.
      let average = await this.#bot.mt.getAverageMovement({
        symbol: this.symbol,
        mins: 30,
      });
      this.calculatedGap = (this.gap * parseFloat(average)) / 2;
    }

    let symbolPrice = this.#bot.mt.subscribedSymbols[this.symbol];

    if (this.calculatedGap < symbolPrice.ask - symbolPrice.bid) {
      this.calculatedGap = symbolPrice.ask - symbolPrice.bid;
    }

    await this.updateLogs({
      msg: `Gap has been calculated: ${this.calculatedGap}`,
    });
    return this.calculatedGap;
  }

  async calculateVolume() {
    await this.gapCalculate();
    let metaData = await db.read("metadata", { username: "mohammedalrawi" });

    if (this.marginPercentage != "0") {
      let marginPerLot = await this.#bot.mt.requiredMargin({
        symbol: this.symbol,
      });

      //TODO: I should check if the trades are fully closed, so the equity is not affected, because if another trade is opened while this trade is executed, the equity would not be the same, and it may cause problems starting the trade
      // let equity = marketPrice.equity;
      let freeMargin = metaData[0].freeMargin;

      this.volume =
        Math.round((freeMargin / marginPerLot) * this.marginPercentage) / 100;
    } else if (this.maximumLoss != "0") {
      let profitPerLot = await this.#bot.mt.calculateProfit({
        symbol: this.symbol,
        gap: (this.calculatedGap * Math.abs(this.slOffset)) / 100,
      });

      let riskAmount = 0;
      if (this.maximumLossType == "%") {
        let equity = metaData[0].equity;
        riskAmount = equity * (parseInt(this.maximumLoss) / 100);
      } else if (this.maximumLossType == "$") {
        riskAmount = this.maximumLoss;
      }
      let volume = riskAmount / profitPerLot;
      this.volume = volume.toFixed(2);
    }

    await this.updateLogs({
      msg: `Volume has been calculated: ${this.volume}`,
    });
    return this.volume;
  }
}

class Position {
  #trade;
  #oppositePosition;
  #bot;
  // all the positions are pending positions.
  constructor({ trade, type, bot }) {
    this.#trade = trade;
    this.type = type;
    this.#bot = bot;
    this.secured = false; // secured is the statement where the SL is set to BE
  }

  async execute(marketPrice, sl) {
    // console.log({ marketPrice });
    if (marketPrice == "now") {
      try {
        let order;
        if (this.type == "POSITION_TYPE_BUY") {
          order = await this.#bot.mt.buyOrder({
            symbol: this.#trade.symbol,
            volume: this.#trade.volume,
            sl,
          });
        } else if (this.type == "POSITION_TYPE_SELL") {
          order = await this.#bot.mt.sellOrder({
            symbol: this.#trade.symbol,
            volume: this.#trade.volume,
            sl,
          });
        }
        this.#trade.updateLogs({
          msg: "double risking position has been executed",
        });
      } catch (err) {
        console.log(err);
      }
      this.ticket = order.ticket;
      return;
    }
    let bidPrice = parseFloat(marketPrice.bid);
    let askPrice = parseFloat(marketPrice.ask);

    try {
      console.log({
        buyOrder: {
          symbol: this.#trade.symbol,
          volume: this.#trade.volume,
          price: askPrice + this.#trade.calculatedGap,
          sl:
            bidPrice +
            this.#trade.calculatedGap -
            (this.#trade.calculatedGap * 2 * Math.abs(this.#trade.slOffset)) /
              100,
        },
        sellOrder: {
          symbol: this.#trade.symbol,
          volume: this.#trade.volume,
          price: bidPrice - this.#trade.calculatedGap,
          sl:
            askPrice -
            this.#trade.calculatedGap +
            (this.#trade.calculatedGap * 2 * Math.abs(this.#trade.slOffset)) /
              100,
        },
      });
      let order;
      if (this.type == "POSITION_TYPE_BUY") {
        order = await this.#bot.mt.buyStopOrder({
          symbol: this.#trade.symbol,
          volume: this.#trade.volume,
          price: askPrice + this.#trade.calculatedGap,
          sl:
            bidPrice +
            this.#trade.calculatedGap -
            (this.#trade.calculatedGap * 2 * Math.abs(this.#trade.slOffset)) /
              100,
        });
      } else if (this.type == "POSITION_TYPE_SELL") {
        order = await this.#bot.mt.sellStopOrder({
          symbol: this.#trade.symbol,
          volume: this.#trade.volume,
          price: bidPrice - this.#trade.calculatedGap,
          sl:
            askPrice -
            this.#trade.calculatedGap +
            (this.#trade.calculatedGap * 2 * Math.abs(this.#trade.slOffset)) /
              100,
        });
      }
      this.ticket = order.ticket;

      await this.#trade.updateLogs({
        msg: `${this.ticket} ${this.type} position has been added successfully.`,
      });

      console.log("Trade successful, result code is " + this.order);
      return this.order;
    } catch (err) {
      console.log("Trade failed with result code ", err);
      console.error(err);
      await this.#trade.updateLogs({
        msg: `${this.ticket} ${this.type} postion could not be made.`,
        err,
      });
      this.#trade.close("rejected");
      throw err;
    }
  }

  // TODO: that should be done directly with events instead
  // check for updating
  async check() {
    this.#bot.mt.emitter.on("positionUpdate", async (pos) => {
      if (pos.ticket == this.ticket) {
        await this.update(pos);
        this.#bot.emitter.emit("positionUpdate", this.#trade.filter());
      }
    });

    this.#bot.mt.emitter.on("orderCancel", async (order) => {
      if (order.ticket == this.ticket) {
        // this.close("Canceled by user.");
        this.state = "canceled";
        if (!this.canceledByOpposite) {
          await this.#trade.close("canceled");
        }
      }
    });

    this.#bot.mt.emitter.on("positionClose", async (pos) => {
      // console.log({ position: `has been deleted and closed the trade.` });
      console.log({ closedPosition: pos });
      if (pos.ticket == this.ticket) {
        if (this.#trade.doubleRisk) {
          try {
            this.#trade.doubleRisk = false;
            await this.#trade.doubleRisking(
              this.type == "POSITION_TYPE_BUY"
                ? "POSITION_TYPE_SELL"
                : "POSITION_TYPE_BUY"
            );
          } catch (err) {
            console.log(err);
            await this.#trade.close("completed");
          }
        } else {
          await this.#trade.close("completed");
        }
        await this.update(pos);
      }
    });

    this.#bot.mt.emitter.on("positionStart", async (pos) => {
      if (pos.ticket == this.ticket) {
        console.log("closing opposite . . .");
        try {
          await this.#oppositePosition.close(true);
          this.#trade.doubleRisk = true;
        } catch (err) {
          console.log(err);
        }
        await this.#trade.timeoutTimer.cancel();
        this.#trade.ticket = this.ticket;
        await this.#trade.changeState("running");

        // this.#trade.runningTime = this.#bot.currentDate();
        await this.track();

        setTimeout(() => {
          this.#trade.doubleRisk = false;
        }, 5000);
      }
    });
  }

  assignOppositePosition(oppositePosition) {
    this.#oppositePosition = oppositePosition;
  }

  // TODO: this should be re-organized as the trade should be secured after it profits for 5 seconds continously,
  async secure() {
    if (this.secured) {
      console.log("trying to secure position but it's already been secured!");
      return;
    }
    if (
      (this.type == "POSITION_TYPE_BUY" &&
        this.profit > 0 &&
        this.sl < this.currentPrice) ||
      (this.type == "POSITION_TYPE_SELL" &&
        this.profit > 0 &&
        this.sl > this.currentPrice)
    ) {
      console.log("trying to secure position");
      try {
        await this.modify({ sl: this.openPrice });
        this.secured = true;
        console.log("position is secured properly");
        return;
      } catch (err) {
        console.log("position couldn't be secured because: ", err);
        return;
      }
    }
  }

  // TODO: this should be checked whether it is needed or not, because the information of a position should be updated directly from the events
  // for updating the properties after it's been placed as a position
  async update(pos) {
    let oldProfit = this.profit;
    for (let properity in pos) {
      this[properity] = pos[properity];
    }
    if (!this.isOrder) {
      if (!this.#trade.positioned) {
        this.#trade.ticket = this.ticket;
        this.#trade.openPrice = this.openPrice;
        this.#trade.magic = this.magic;
        this.#trade.orderOpenTime = this.orderOpenTime;
        this.#trade.type = this.type;
        this.#trade.volume = this.volume;
        this.#trade.positioned = true;
      }
      this.#trade.currentPrice = this.currentPrice;
      this.#trade.profit = this.profit;
      this.#trade.secured = this.secured;
      this.#trade.tp = this.tp;
      this.#trade.sl = this.sl;
    }

    await this.checkPartialClose();
    if (this.secured == true) return;
    if (this.profit > 0 && oldProfit < 0) {
      console.log("secureing");
      this.secureTimeout = setTimeout(() => {
        this.secure();
      }, 5000);
    } else if (this.profit < 0 && oldProfit > 0) {
      console.log("remove secure");
      clearTimeout(this.secureTimeout);
    }
  }

  // TODO: if it works fine, I think t is OK.i But if the structure is differenet using the sockets, then it should be checked
  async modify({ sl, tp }) {
    try {
      console.log(`modifyingPosition: ${{ sl, tp }}`);
      if (
        (this.type == "POSITION_TYPE_BUY" && sl < this.sl) ||
        (this.type == "POSITION_TYPE_SELL" && sl > this.sl)
      )
        return;

      await this.#bot.mt.modifyPosition({ ticket: this.ticket, sl, tp });
      await this.#trade.updateLogs({
        msg: `${this.type} position has been modified to: {tp: ${tp}, sl: ${sl}}`,
      });
      return;
    } catch (err) {
      await this.#trade.updateLogs({
        msg: `${this.type} position hasn't been able to be modified`,
        err,
      });
    }
  }

  async testTrack({ count }) {
    const THIS = this;
    if (!this.#trade.stops) {
      this.#trade.stops = {
        m1: 0,
        m2: 0,
        m3: 0,
        m4: 0,
        m5: 0,
        m6: 0,
        m7: 0,
        m8: 0,
        m9: 0,
        m10: 0,
        m11: 0,
        m12: 0,
        m13: 0,
        m14: 0,
        m15: 0,
        ma5: 0,
        ma10: 0,
        ma15: 0,
        ma3c5: 0,
        ma3c10: 0,
        ma3c15: 0,
        ma5c10: 0,
        ma10c15: 0,
      };

      this.sls = {
        m1: 0,
        m2: 0,
        m3: 0,
        m4: 0,
        m5: 0,
        m6: 0,
        m7: 0,
        m8: 0,
        m9: 0,
        m10: 0,
        m11: 0,
        m12: 0,
        m13: 0,
        m14: 0,
        m15: 0,
      };

      THIS.hitTargetStops = [];
      THIS.profits = [];
      console.log(THIS.hitTargetStops, THIS.hitTargetStops.length);
    }

    THIS.profits.unshift(THIS.profit);
    let currentMinutePrice;

    await new Promise((resolve) => {
      setTimeout(async () => {
        currentMinutePrice = await THIS.#bot.mt.getMinutePrice({
          symbol: THIS.symbol,
          min: 1,
        });
        resolve();
      }, 2000);
    });

    if (THIS.hitTargetStops.length == 23) {
      THIS.#trade.close();
      return;
    }

    let pastMinutes = await THIS.#bot.mt.getPastMinutes({
      symbol: THIS.symbol,
      mins: 20,
    });

    for (let stop in THIS.#trade.stops) {
      if (/^m([0-9]+)$/.test(stop)) {
        // minutes
        let min = parseInt(stop.replace("m", ""));
        checkVirtualMinuteStop({ stop, min, count });
      } else if (/^ma[0-9]+$/.test(stop)) {
        // moving average
        let ma = parseInt(stop.replace("ma", ""));
        checkVirtualMAStop({ stop, ma });
      } else if (/^ma[0-9]+c[0-9]+$/.test(stop)) {
        // moving average cross
        let match = stop.match(/^ma(\d+)c(\d+)$/);
        let ma = parseInt(match[1]);
        let cross = parseInt(match[2]);
        checkVirtualMACrossStop({ stop, ma, cross });
      }
    }

    function checkVirtualMinuteStop({ stop, min, count }) {
      if (count < min) return;
      if (THIS.hitTargetStops.includes(stop)) return;
      if (
        (THIS.type == "POSITION_TYPE_BUY" &&
          currentMinutePrice.low < pastMinutes[min]) ||
        (THIS.type == "POSITION_TYPE_SELL" &&
          currentMinutePrice.high > pastMinutes[min])
      ) {
        THIS.hitTargetStops.push(stop);
        THIS.#trade.stops[stop] = THIS.profits[min];
        THIS.#trade.updateLogs({
          msg: `${stop} stop has been closed with profit: ${THIS.profits[min]}$`,
        });
      }
    }

    function checkVirtualMAStop({ stop, ma }) {
      if (THIS.hitTargetStops.includes(stop)) return;
      let maAverage = getAverage(pastMinutes, ma);
      let lastMaAverage = getAverage(pastMinutes, ma, 1);
      if (
        (THIS.type == "POSITION_TYPE_BUY" && maAverage < lastMaAverage) ||
        (THIS.type == "POSITION_TYPE_SELL" && maAverage > lastMaAverage)
      ) {
        THIS.hitTargetStops.push(stop);
        THIS.#trade.stops[stop] = THIS.profit;
        THIS.#trade.updateLogs({
          msg: `${stop} stop has been closed with profit: ${THIS.profit}$`,
        });
      }
    }

    function checkVirtualMACrossStop({ stop, ma, cross }) {
      if (THIS.hitTargetStops.includes(stop)) return;
      let shortAverage = getAverage(pastMinutes, ma);
      let longAverage = getAverage(pastMinutes, cross);
      if (
        (THIS.type == "POSITION_TYPE_BUY" && shortAverage < longAverage) ||
        (THIS.type == "POSITION_TYPE_SELL" && shortAverage > longAverage)
      ) {
        THIS.#trade.stops[stop] = THIS.profit;
        THIS.#trade.updateLogs({
          msg: `${stop} stop has been closed with profit: ${THIS.profit}$`,
        });
        THIS.hitTargetStops.push(stop);
      }
    }

    function getAverage(arr, ma, shift = 0) {
      let subarray = arr.slice(1 + shift, ma);
      let sum = subarray.reduce((acc, curr) => acc + curr, 0);
      let average = sum / subarray.length;
      return average;
    }
  }

  // TODO: checking if the position has been placed is a depricated method, because it should be known directly from the events
  // check if the order has been placed, if so, then close position by ID, else cancel the order.
  async close(opposite) {
    if (this.state == "canceled") return;
    if (opposite) {
      try {
        await this.#bot.mt.cancelOrder({
          ticket: this.ticket,
          msg: "closed by opposite",
        });
        console.log("opposite closed.");
        this.state = "canceled";
        this.canceledByOpposite = true;
        return;
      } catch (err) {
        throw err;
      }
    }

    try {
      switch (this.#trade.state) {
        case "pending":
          await this.#trade.changeState("canceled");
          break;
        case "executed":
          await this.#bot.mt.cancelOrder({
            ticket: this.ticket,
            msg: "executed",
          });
          break;
        case "timeout":
          await this.#bot.mt.cancelOrder({
            ticket: this.ticket,
            msg: "timeout",
          });
          break;
        case "rejected":
          await this.#bot.mt.cancelOrder({
            ticket: this.ticket,
            msg: "rejected",
          });
          break;
        case "running":
          await this.#bot.mt.closePosition({ ticket: this.ticket });
          await this.#trade.changeState("completed");
          break;
        case "completed":
          await this.#bot.mt.closePosition({ ticket: this.ticket });
          break;
        case "canceled":
          // TODO: there should not be canceled state added inside Trade, it should be always stated above
          await this.#bot.mt.cancelOrder({
            ticket: this.ticket,
            msg: "canceled",
          });
          break;
      }
      if (this.#trade.hasOwnProperty("updateLogs"))
        await this.#trade.udpateLogs({
          msg: `${this.type} position has been closed.`,
        });
    } catch (err) {
      await this.#trade.updateLogs({
        msg: `Couldn't close ${this.type} postion ${this.ticket}`,
        err,
      });
    }

    this.trackingTimer.cancel();

    // if (this.state == "canceled") return;
    // this.state = "canceled";

    // try {
    // 	if (this.order && this.order.positionId) {
    // 		await this.#trade
    // 			.MT()
    // 			.MTConnection()
    // 			.closePosition(this.order.positionId);
    // 	} else {
    // 		await this.#trade.MT().MTConnection().cancelOrder(this.order.id);
    // 	}
    // } catch (err) {
    // 	console.error(err);
    // }
    this.state = "canceled";
  }

  // for tracking and setting the stoploss to a specified point, so the trade would be profitable when it hits the stoploss
  async track() {
    let stopMechanism = "ma10";
    console.log("start tracking");
    let count = 0;
    this.trackingTimer = schedule.scheduleJob("*/1 * * * *", async () => {
      console.log("tracking timer");

      if (
        count > this.#trade.trailingMinutes &&
        stopMechanism == "trailingMinutes"
      ) {
        let trailingPrice = await this.trailingMinutePrice({
          symbol: this.symbol,
          min: this.#trade.trailingMinutes,
        });
        this.modify({ sl: trailingPrice.close });
      }

      const THIS = this;

      if (stopMechanism == "ma10") {
        let pastMinutes = await THIS.#bot.mt.getPastMinutes({
          symbol: THIS.symbol,
          mins: 20,
        });

        checkVirtualMAStop({ stop: stopMechanism, ma: 10 });

        function checkVirtualMAStop({ stop, ma }) {
          // if (THIS.hitTargetStops.includes(stop)) return;
          let maAverage = getAverage(pastMinutes, ma);
          let lastMaAverage = getAverage(pastMinutes, ma, 1);
          console.log({ maAverage, lastMaAverage });
          if (
            (THIS.type == "POSITION_TYPE_BUY" && maAverage < lastMaAverage) ||
            (THIS.type == "POSITION_TYPE_SELL" && maAverage > lastMaAverage)
          ) {
            // THIS.hitTargetStops.push(stop);
            // THIS.#trade.stops[stop] = THIS.profit;
            THIS.#trade.updateLogs({
              msg: `${stop} stop has been closed with profit: ${THIS.profit}$`,
            });
            THIS.#trade.close("completed");
          }
        }

        function getAverage(arr, ma, shift = 0) {
          let subarray = arr.slice(1 + shift, ma + 1);
          let sum = subarray.reduce((acc, curr) => acc + curr, 0);
          let average = sum / subarray.length;
          return average;
        }
      }

      // await this.testTrack({ count });
      count++;
    });
  }

  async trailingMinutePrice({ symbol, min }) {
    return await this.#bot.mt.getMinutePrice({ symbol, min });
  }

  async checkPartialClose() {
    // this function does not run when the trade is secured.
    if (this.partiallyClosed || !this.#trade.doubleRisk) return;
    this.#trade.partialClosePercentage = Number(
      this.#trade.partialClosePercentage
    );
    this.#trade.partialCloseTarget = Number(this.#trade.partialCloseTarget);
    console.log({
      profit: this.profit,
      target: this.#trade.partialCloseTarget,
      condition: this.profit >= this.#trade.partialCloseTarget,
    });
    if (this.#trade.partialCloseTargetType == "%") {
      if (
        Math.abs(this.currentPrice - this.openPrice) >
        Math.abs(
          ((this.openPrice - this.sl) * this.#trade.partialCloseTarget) / 100
        )
      ) {
        await this.#bot.mt.partialClose({
          ticket: this.ticket,
          percentage: this.#trade.partialClosePercentage,
        });
        this.partiallyClosed = true;
        await this.#trade.updateLogs({
          msg: `${this.#trade.id} has been partially closed by ${
            this.#trade.partialClosePercentage
          }%`,
        });
      }
    } else if (this.#trade.partialCloseTargetType == "$") {
      if (this.profit >= this.#trade.partialCloseTarget) {
        await this.#bot.mt.partialClose({
          ticket: this.ticket,
          percentage: this.#trade.partialClosePercentage,
        });
        this.partiallyClosed = true;
        await this.#trade.updateLogs({
          msg: `${this.#trade.id} has been partially closed by ${
            this.#trade.partialClosePercentage
          }%`,
        });
      }
    }
  }
}

module.exports = Bot;
