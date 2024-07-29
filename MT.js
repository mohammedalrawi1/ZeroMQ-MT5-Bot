const zmq = require("zeromq");
const EventEmitter = require("events");

class MT {
  constructor({
    protocol = "tcp",
    host = "127.0.0.1",
    reqPort = "5551",
    backupReqPort = "5553",
    subPort = "5550",
    posSubPort = "5552", // subscribing port to positions and orders
  }) {
    this.link = `${protocol}://${host}`;
    this.reqLink = `${this.link}:${reqPort}`;
    this.backupReqLink = `${this.link}:${backupReqPort}`;
    this.subLink = `${this.link}:${subPort}`;
    this.posSubLink = `${this.link}:${posSubPort}`;
    this.subscribedSymbols = {};
    this.emitter = new EventEmitter();
    this.trades = {};
    this.init();
  }

  async init() {
    console.log("Initializing MT . . . ");
    this.reqSocket = await this.reqSocketConnect();
    this.backupReqSocket = await this.backupReqSocketConnect();
    this.subSocketConnect();
    this.posSubSocketConnect();
    this.initialized = true;
  }

  async reqSocketConnect() {
    const sock = new zmq.Request();

    console.log(
      `[REQ] Connecting socket to MT5 Server on link: ${this.reqLink} . . .`
    );
    await sock.connect(this.reqLink);
    console.log("Request Socket has been connected to MT5 server.");

    return sock;
  }

  async backupReqSocketConnect() {
    const sock = new zmq.Request();

    console.log(
      `[BUREQ] Connecting socket to MT5 Server on link: ${this.reqLink} . . .`
    );
    await sock.connect(this.reqLink);
    console.log("Request Socket has been connected to MT5 server.");

    return sock;
  }

  async subSocketConnect() {
    const subscriber = new zmq.Subscriber();

    // Connect to the publisher
    console.log(
      `[SUB] Connecting socket to MT5 Server on link: ${this.subLink} . . .`
    );
    await subscriber.connect(this.subLink);

    // Subscribe to all messages
    subscriber.subscribe();

    console.log("Subscribe Socket has been connected to MT5 server.");

    for await (const [message] of subscriber) {
      let newData = JSON.parse(message);
      newData = classify(newData);
      if (!this.subscribedSymbols.hasOwnProperty(newData.symbol)) {
        this.subscribedSymbols[newData.symbol] = newData;
        this.emitter.emit("symbol", newData);
      }

      let oldData = this.subscribedSymbols[newData.symbol];

      if (newData.bid != oldData.bid || newData.ask != oldData.ask) {
        this.emitter.emit("symbol", newData);
        this.subscribedSymbols[newData.symbol] = newData;
      }
    }
  }

  async posSubSocketConnect() {
    const posSubscriber = new zmq.Subscriber();

    // Connect to the publisher
    console.log(
      `[POS_SUB] Connecting socket to MT5 Server on link: ${this.posSubLink} . . .`
    );
    await posSubscriber.connect(this.posSubLink);
    console.log("Position Subscribe Socket has been connected to MT5 server.");

    // Subscribe to all messages
    posSubscriber.subscribe();

    for await (const [message] of posSubscriber) {
      // connect to event emitter here.
      let res = JSON.parse(message);
      res = classify(res);
      if (res.metadata) {
        this.emitter.emit("metadataChange", {
          res,
        });
      }
      if (res.event) {
        this.emitter.emit(res.event, {
          ticket: res.positionTicket ? res.positionTicket : res.orderTicket,
          symbol: res.symbol,
          volume: res.volume,
          profit: res.profit,
        });
      } else if (this.trades.hasOwnProperty(res.ticket)) {
        this.trades[res.ticket].update(res);
      } else {
        this.trades[res.ticket] = new Position(res, this);
        this.emitter.emit("tradeStart", res);
      }
    }
  }

  async buyStopOrder({ symbol, price, sl, tp, volume }) {
    let req = {
      method: "TRADE",
      action: "OPEN",
      type: "BUYSTOP",
      symbol,
      price,
      sl,
      tp,
      volume,
    };

    await this.reqSocket.send(JSON.stringify(req));
    let [result] = await this.reqSocket.receive();
    let jsonResult = JSON.parse(result.toString());
    jsonResult = classify(jsonResult);
    if (jsonResult.error) {
      this.error(jsonResult);
      throw jsonResult;
    }
    return jsonResult;
  }

  async sellStopOrder({ symbol, price, sl, tp, volume }) {
    let req = {
      method: "TRADE",
      action: "OPEN",
      type: "SELLSTOP",
      symbol,
      price,
      sl,
      tp,
      volume,
    };

    await this.reqSocket.send(JSON.stringify(req));
    let [result] = await this.reqSocket.receive();
    let jsonResult = JSON.parse(result.toString());
    jsonResult = classify(jsonResult);
    if (jsonResult.error) {
      this.error(jsonResult);
      throw jsonResult;
    }
    return jsonResult;
  }

  async buyOrder({ symbol, sl, tp, volume }) {
    let req = {
      method: "TRADE",
      action: "OPEN",
      type: "BUY",
      symbol,
      sl,
      tp,
      volume,
    };

    console.log(req);

    await this.reqSocket.send(JSON.stringify(req));
    let [result] = await this.reqSocket.receive();
    let jsonResult = JSON.parse(result.toString());
    jsonResult = classify(jsonResult);
    if (jsonResult.error) {
      this.error(jsonResult);
      throw jsonResult;
    }
    return jsonResult;
  }

  async sellOrder({ symbol, sl, tp, volume }) {
    let req = {
      method: "TRADE",
      action: "OPEN",
      type: "SELL",
      symbol,
      sl,
      tp,
      volume,
    };

    console.log(req);

    await this.reqSocket.send(JSON.stringify(req));
    let [result] = await this.reqSocket.receive();
    let jsonResult = JSON.parse(result.toString());
    jsonResult = classify(jsonResult);
    if (jsonResult.error) {
      this.error(jsonResult);
      throw jsonResult;
    }
    return jsonResult;
  }

  async cancelOrder({ ticket, msg }) {
    console.log({ ticket, msg });
    let req = {
      method: "TRADE",
      action: "CANCEL",
      ticket,
    };

    await this.reqSocket.send(JSON.stringify(req));
    let [result] = await this.reqSocket.receive();
    let jsonResult = JSON.parse(result.toString());
    jsonResult = classify(jsonResult);
    if (jsonResult.error) {
      this.error(jsonResult);
      throw jsonResult;
    }
    return jsonResult;
  }

  async closePosition({ ticket }) {
    let req = {
      method: "TRADE",
      action: "CLOSE",
      ticket,
    };

    await this.reqSocket.send(JSON.stringify(req));
    let [result] = await this.reqSocket.receive();
    let jsonResult = JSON.parse(result.toString());
    jsonResult = classify(jsonResult);
    if (jsonResult.error) {
      this.error(jsonResult);
      throw jsonResult;
    }
    return jsonResult;
  }

  async partialClose({ ticket, percentage }) {
    let req = {
      method: "TRADE",
      action: "CLOSE_PARTIAL",
      partialClosePercentage: percentage / 100,
      ticket,
    };

    console.log({ req });

    await this.reqSocket.send(JSON.stringify(req));
    let [result] = await this.reqSocket.receive();
    let jsonResult = JSON.parse(result.toString());
    jsonResult = classify(jsonResult);
    if (jsonResult.error) {
      this.error(jsonResult);
      console.log(jsonResult);
    }
    return jsonResult;
  }

  async modifyPosition({ ticket, sl, tp }) {
    let req = {
      method: "TRADE",
      action: "MODIFY",
      sl,
      tp,
      ticket,
    };

    await this.reqSocket.send(JSON.stringify(req));
    let [result] = await this.reqSocket.receive();
    let jsonResult = JSON.parse(result.toString());
    jsonResult = classify(jsonResult);
    if (jsonResult.error) {
      this.error(jsonResult);
      throw jsonResult;
    }
    return jsonResult;
  }

  async symbolSubscribe({ symbol }) {
    let req = {
      method: "SUB",
      symbol,
    };

    await this.reqSocket.send(JSON.stringify(req));
    let [result] = await this.reqSocket.receive();
    let jsonResult = JSON.parse(result.toString());
    jsonResult = classify(jsonResult);
    if (jsonResult.error) {
      // this.error(jsonResult);
      // TODO: make this a "throw jsonResult" after debugging
      return jsonResult;
    }
    return jsonResult;
  }

  async symbolUnsubscribe({ symbol }) {
    let req = {
      method: "UNSUB",
      symbol,
    };

    await this.reqSocket.send(JSON.stringify(req));
    let [result] = await this.reqSocket.receive();
    let jsonResult = JSON.parse(result.toString());
    jsonResult = classify(jsonResult);
    if (jsonResult.error) {
      // this.error(jsonResult);
      // throw jsonResult;
    } else {
      this.subscribedSymbols[symbol] = {};
      return jsonResult;
    }
  }
  async getSymbolPrice({ symbol }) {
    let req = {
      method: "DATA",
      task: "SYMBOL_PRICE",
      symbol,
    };

    await this.reqSocket.send(JSON.stringify(req));
    let [result] = await this.reqSocket.receive();
    let jsonResult = JSON.parse(result.toString());
    jsonResult = classify(jsonResult);
    return jsonResult;
  }

  async getSymbolSpecifications({ symbol }) {
    let req = {
      method: "DATA",
      task: "SYMBOL_SPECIFICATIONS",
      symbol,
    };

    await this.reqSocket.send(JSON.stringify(req));
    let [result] = await this.reqSocket.receive();
    let jsonResult = JSON.parse(result.toString());
    jsonResult = classify(jsonResult);
    return jsonResult;
  }

  async updateMetaData() {
    let req = {
      method: "DATA",
      task: "METADATA",
    };

    await this.reqSocket.send(JSON.stringify(req));
    await this.reqSocket.receive();
    return;
  }

  async calculateProfit({ symbol, gap }) {
    let specifications = await this.getSymbolSpecifications({ symbol });
    let symbolPrice = await this.getSymbolPrice({ symbol });
    let ask = symbolPrice.askPrice;
    let bid = symbolPrice.price;
    let spread = Math.abs(ask - bid);
    gap += spread + gap;
    let profit = gap * specifications.contractSize;
    if (specifications.currencyProfit != "USD") {
      if (specifications.currencyMargin == "USD") {
        profit = profit / bid;
      } else if (specifications.currencyMargin != "USD") {
        let { price } = await this.getSymbolPrice({
          symbol: `USD${specifications.currencyProfit}`,
        });
        profit = profit / price;
      }
    }
    console.log({ profit });
    return profit;
  }

  async requiredMargin({ symbol, volume = 1 }) {
    let req = {
      method: "DATA",
      task: "REQUIRED_MARGIN",
      symbol,
      volume,
    };

    await this.reqSocket.send(JSON.stringify(req));
    let [result] = await this.reqSocket.receive();
    let jsonResult = JSON.parse(result.toString());
    jsonResult = classify(jsonResult);
    if (jsonResult.currencyMargin != "USD") {
      if (jsonResult.symbol.match(/USD$/)) {
        jsonResult.requiredMargin =
          jsonResult.requiredMargin * jsonResult.price;
      } else {
        let newSymbol = await this.getSymbolPrice({
          symbol: `${jsonResult.symbol.match(/^.{3}/)}USD`,
        });
        jsonResult.requiredMargin = jsonResult.requiredMargin * newSymbol.price;
      }
    } else {
      if (jsonResult.symbol.match(/USD$/)) {
        jsonResult.requiredMargin =
          volume *
          jsonResult.initial *
          jsonResult.contractSize *
          jsonResult.price;
      }
    }
    return jsonResult.requiredMargin;
  }

  async getAverageMovement({ symbol, mins }) {
    let req = {
      method: "DATA",
      task: "AVERAGE_MOVE",
      symbol,
      mins,
    };

    await this.reqSocket.send(JSON.stringify(req));
    let [result] = await this.reqSocket.receive();
    let jsonResult = JSON.parse(result.toString());
    jsonResult = classify(jsonResult);
    let average = jsonResult.average;
    return average;
  }

  async getMinutePrice({ symbol, min }) {
    let req = {
      method: "DATA",
      task: "MINUTE_PRICE",
      symbol,
      min,
    };

    await this.reqSocket.send(JSON.stringify(req));
    let [result] = await this.reqSocket.receive();
    let price = JSON.parse(result.toString());
    price = classify(price);
    console.log(price);
    return price;
  }

  async getPastMinutes({ symbol, mins }) {
    let req = {
      method: "DATA",
      task: "PAST_MINUTES",
      symbol,
      mins,
    };

    await this.reqSocket.send(JSON.stringify(req));
    let [result] = await this.reqSocket.receive();
    let response = JSON.parse(result.toString());
    response = classify(response);
    let minutesArray = JSON.parse(response.minutes);
    minutesArray.reverse();
    let floatArray = minutesArray.map((str) => parseFloat(str));
    floatArray.unshift(undefined);
    console.log(floatArray);
    return floatArray;
  }

  error(err) {
    console.error(err);
  }
}

class Position {
  #mt;
  constructor(
    {
      ticket,
      type,
      symbol,
      volume,
      openPrice,
      magic,
      currentPrice,
      tp,
      sl,
      profit,
      swap,
      positionOpenTime,
      orderOpenTime,
      isOrder,
    },
    mt
  ) {
    this.ticket = ticket;
    this.type = type;
    this.symbol = symbol;
    this.volume = volume;
    this.openPrice = openPrice;
    this.magic = magic;
    this.currentPrice = currentPrice;
    this.tp = tp;
    this.sl = sl;
    this.profit = profit;
    this.swap = swap;
    this.positionOpenTime = positionOpenTime;
    this.orderOpenTime = orderOpenTime;
    this.isOrder = isOrder;
    this.#mt = mt;
  }

  update(args) {
    let updated = false;
    for (let properity in args) {
      if (this[properity] != args[properity]) {
        updated = true;
        break;
      }
    }
    if (!updated) return;
    for (let properity in args) {
      this[properity] = args[properity];
    }
    this.#mt.emitter.emit("positionUpdate", this);
  }
}

function classify(obj) {
  // return obj;
  let typeSpecs = {
    orderTicket: "number",
    positionTicket: "number",
    symbol: "string",
    volume: "number",
    event: "string",
    startPrice: "number",
    isOrder: "boolean",
    ticket: "number",
    type: "string",
    openPrice: "number",
    currentPrice: "number",
    tp: "number",
    sl: "number",
    profit: "number",
    swap: "number",
    positionOpenTime: "number",
    orderOpenTime: "number",
    balance: "number",
    broker: "string",
    credit: "number",
    currency: "string",
    equity: "number",
    freeMargin: "number",
    leverage: "number",
    margin: "number",
    name: "string",
    server: "string",
    tradeAllowed: "number",
    marginLevel: "number",
    error: "number",
    message: "string",
    contractSize: "number",
    currencyMargin: "string",
    currencyProfit: "string",
    tickSize: "number",
    tickValue: "number",
    tickValueLoss: "number",
    tickValueProfit: "number",
    point: "number",
    swapShort: "number",
    swapLong: "number",
    maxVolume: "number",
    minVloume: "number",
    high: "number",
    open: "number",
    close: "number",
    low: "number",
    average: "number",
    askPrice: "number",
    price: "number",
    ask: "number",
    bid: "number",
    magic: "number",
  };

  let newObj = {};

  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      switch (typeSpecs[key]) {
        case "number":
          newObj[key] = Number(obj[key]);
          break;
        case "boolean":
          newObj[key] = newObj[key] == "true" ? true : false;
          break;
        case "date":
          newObj[key] = new Date(obj[key]);
          break;
        case "string":
          newObj[key] = obj[key];
          break;
        default:
          newObj[key] = obj[key];
          break;
      }
    }
  }

  // console.log({ obj, newObj });

  return newObj;
}

module.exports = MT;

// let mt = new MT({});

// mt.calculateProfit({ symbol: "EURUSD", gap: 0.0001 });
