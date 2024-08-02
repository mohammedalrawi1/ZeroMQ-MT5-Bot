class ZMQBuffer {
  constructor({ mt }) {
    this.mt = mt;
    this.requestQueue = [];
    this.processing = false;
  }

  async send(req) {
    req = new Request(req);
    console.log({ req });
    this.requestQueue.push(req);
    await this.startProcessing();
    return req.promise;
  }

  async startProcessing() {
    if (this.processing) return;
    this.processQueue();
    this.processing = true;
  }

  async processQueue() {
    console.log("processQueue");
    if (this.requestQueue.length == 0) {
      this.processing = false;
      console.log("queue emptied");
      return;
    }

    const req = this.requestQueue.shift();
    console.log({ queue: this.requestQueue, errReq: req });
    try {
      const result = await this.sendRequest(req);
      console.log({ result });
      req.resolve(result);
    } catch (error) {
      req.reject(error);
    }
    await this.processQueue();
  }

  async sendRequest(req) {
    await this.mt.reqSocket.send(JSON.stringify(req.data));
    let [result] = await this.mt.reqSocket.receive();
    let jsonResult = JSON.parse(result.toString());
    jsonResult = this.classify(jsonResult);
    if (jsonResult.error) {
      throw jsonResult;
    } else {
      return jsonResult;
    }
  }

  classify(obj) {
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
}

class Request {
  constructor(data) {
    this.data = data;
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  async send(zmqBuffer) {
    await zmqBuffer.send(this);
    return this.promise;
  }
}

module.exports = ZMQBuffer;
