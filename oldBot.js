const MetaApi = require("metaapi.cloud-sdk").default;
let SynchronizationListener =
	require("metaapi.cloud-sdk").SynchronizationListener;
const MongoDB = require("./MongoDB.js");
let db = new MongoDB("socket", "mongodb://127.0.0.1:27017");
const schedule = require("node-schedule");
const EventEmitter = require("events");
const { createDecipheriv } = require("crypto");

class MT extends SynchronizationListener {
	#metaToken;
	#metaAccountId;
	#api;
	#account;
	#connection;

	constructor(metaToken, metaAccountId) {
		super();
		this.events = new EventEmitter();
		this.#metaToken = metaToken;
		this.#metaAccountId = metaAccountId;
		this.connected = false;
		this.trades = [];
		this.lastPrice = {};
		this.positionTradeMap = {};
		this.setDefualtSettings();
		this.connectToMeta();
	}

	async connectToMeta() {
		this.#api = new MetaApi(this.#metaToken);
		try {
			this.#account = await this.#api.metatraderAccountApi.getAccount(
				this.#metaAccountId
			);

			// wait until account is deployed and connected to broker
			console.log("Deploying account");
			if (this.#account.state !== "DEPLOYED") {
				await this.#account.deploy();
			} else {
				console.log("Account already deployed");
			}
			console.log(
				"Waiting for API server to connect to broker (may take couple of minutes)"
			);
			if (this.#account.connectionStatus !== "CONNECTED") {
				await this.#account.waitConnected();
			}

			// create connection
			this.#connection = this.#account.getStreamingConnection();

			// const quoteListener = new QuoteListener();
			this.#connection.addSynchronizationListener(this);

			// connect to MetaApi API
			await this.#connection.connect();

			// wait until terminal state synchronized to the local state
			console.log(
				"Waiting for SDK to synchronize to terminal state (may take some time depending on your history size)"
			);
			await this.#connection.waitSynchronized();
			this.reopenPendingOrders();

			// // for testing porpuses, should be removed.
			// await this.#connection.subscribeToMarketData("XAUUSD.c", [
			// 	// { type: "quotes", intervalInMilliseconds: 5000 },
			// 	// { type: "candles", timeframe: "1m", intervalInMilliseconds: 10000 },
			// 	// { type: "ticks", intervalInMilliseconds: 250 },
			// 	// { type: "marketDepth", intervalInMilliseconds: 5000 },
			// ]);
		} catch (err) {
			console.error(err);
		}
		// process.exit();
	}

	MTConnection() {
		return this.#connection;
	}

	async setDefualtSettings() {
		let userMetadata = await db.read("metadata", {
			username: "mohammedalrawi",
		});
		console.log("usermetadata:");
		console.log(userMetadata);
		this.defaultSettings = userMetadata[0].defaultSettings;
	}

	//TODO:
	// check for 'this.trades' array, and make it work better by removing and adding trades
	async newTrade(argsObj, isOld) {
		let trade = new Trade({ ...argsObj, mt: this });

		if (isOld) return;
		try {
			await trade.init();
			this.trades.push(trade);
			return trade;
		} catch (err) {
			console.error(err);
			throw err;
		}
	}

	async getSymbolSpecification(symbol) {
		db.read("symbols", { symbol });
	}

	async reopenPendingOrders() {
		let oldPendingTrades = await db.read("trades", { state: "pending" });
		for (let i = 0; i < oldPendingTrades.length; i++) {
			const trade = oldPendingTrades[i];
			this.newTrade(trade, true);
		}
	}

	emit(trigger, message) {
		this.events.emit(trigger, message);
	}

	getTradeByPositionID(positionID) {
		return this.positionTradeMap[positionID];
	}

	async onBrokerConnectionStatusChanged(i, connection) {
		// send to client and change a dot between red and green
		this.emit("broker connection", connection);
	}

	async onAccountInformationUpdated(i, accountInformation) {
		// update the database and send to client
		db.update("metadata", { username: "mohammedalrawi" }, accountInformation);
		this.emit("information update", accountInformation);
	}

	async onPositionUpdated(i, position) {
		// send it to the client and update tracking
		this.emit("position update", position);
		console.log(position);
	}

	async onPositionRemoved(i, positionId) {
		// stop tracking, send signal to client, close trade, save it to the database
		this.emit("position remove", positionId);
	}

	async onPendingOrderUpdated(instanceIndex, order) {
		// send it to the client
		this.emit("pending order update", order);
	}

	async onPendingOrderCompleted(instanceIndex, orderId) {
		// close opposite, wait a second if the position will be initialized then it is 'executed', if not then it is 'canceled or rejected' (rejected it's term to the trade if it's exceeded timout ... etc)
		this.emit("pending order complete", orderId);
	}

	async onSymbolSpecificationUpdated(instanceIndex, specification) {
		db.update("symbols", { symbol: specification.symbol }, specification);
		this.emit("symbol specification update", specification);
	}

	async onSymbolPriceUpdated(instanceIndex, price) {
		// TODO: will be in mind to add in the future to create more stratigies
		// the price should be starting updating after subscribing to a symbol, or after a trade started
		this.lastPrice[price.symbol] = { bid: price.bid, ask: price.ask };
		// console.log("lastprice");
		// console.log(this.lastPrice);
		this.emit("symbol price update", price);
	}
}

class Trade {
	// NOTE: all trades will start as a pending trade
	#mt;
	#initData;
	constructor(args) {
		// assigning all the arguments to the Trade object accordingly
		args.logs = [];
		let { mt, ...initArgs } = args;
		this.#initData = initArgs;
		for (let key in args) {
			if (args.hasOwnProperty(key)) {
				if (typeof args[key] == "string" && args[key] == "") {
					args[key] = args.mt.defaultSettings[key];
				}
				if (key == "mt") {
					this.#mt = args[key];
				} else {
					this[key] = args[key];
				}
			}
		}

		this.virtualTime = new Date(this.virtualTime);
		this.gapCalculate();
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
		} else {
			await this.updateDB({
				logs: `trying to change state to ${state} but it is invalid state`,
			});
			console.error("the state is not verfied");
		}
	}

	async init() {
		// TODO: check all the states, so it works fine
		if (this.state == "pending") {
			console.log("has been initialized before");
			return;
		}
		try {
			let createdData = await db.create("trades", this.#initData, true);
			this.id = createdData;
		} catch (err) {
			console.log(err);
			throw err;
		}
		this.startTimer();
	}

	MT() {
		return this.#mt;
	}

	async subscribeToMarketData(time) {
		let trade = this;
		if (time === "NOW") {
			await subscribe();
		} else if (time) {
			schedule.scheduleJob(time, async () => {
				try {
					await subscribe();
					console.log(`price subscription (${this.symbol}) started: `);
				} catch (err) {
					console.error(
						`couldn't subscribe to (${this.symbol}) price because: `
					);
					console.error(err);
					await this.close("rejected", {
						logs: [err, "couldn't subscribe to a symbol"],
					});
				}
			});
		}

		async function subscribe() {
			await trade.#mt
				.MTConnection()
				.subscribeToMarketData(trade.symbol, [
					{ type: "ticks", intervalInMilliseconds: 250 },
				]);
		}
	}

	async startTimer() {
		if (!this.virtualTime) await this.close("rejected", "Invalid virtualTime");

		this.buyPosition = new Position({ trade: this, type: "buy" });
		this.sellPosition = new Position({ trade: this, type: "sell" });

		this.buyPosition.assignOppositePosition(this.sellPosition);
		this.sellPosition.assignOppositePosition(this.buyPosition);

		// need to check if the time sent by the client is in the past 1 minutes, to immedietly initilize the trade and execute it
		// otherwise, if the time has past more than 1 minutes, the trade would be rejected with an error
		let minDiff =
			new Date(this.virtualTime).getTime() / 1000 / 60 -
			new Date().getTime() / 1000 / 60;
		if (minDiff > -1 && minDiff < 0) {
			console.log("last minute");
			this.virtualTime = new Date();
			await this.subscribeToMarketData("NOW");
			await this.execute();
		} else if (minDiff < -1) {
			console.log("more than one minute past");
			await this.close("rejected", "old virtualTime");
			return;
		} else {
			console.log("regular time");
			this.subscribeToMarketData(this.virtualTime.getTime() - 15000);
			schedule.scheduleJob(
				this.virtualTime.getTime() - 7000,
				async () => await this.execute()
			);
		}

		schedule.scheduleJob(
			this.virtualTime.getTime() + this.timeout * 1000,
			async () => {
				console.log("timeout hit: ", this.timeout);
				try {
					// TODO: checking if the code below still works with sockets
					await this.close("timeout");
				} catch (err) {
					console.error("couldn't stop by timeout because: ");
					console.error(err);
					await this.updateDB({ logs: err });
				}
			}
		);
		return;
	}

	// updating the data of the trade on MongoDB, and concatenating the logs so it will not be overwriten
	// TODO: logs seems not working
	async updateDB(newData) {
		let oldData = await db.read("trades", { id: this.id });
		if (!Array.isArray(newData.logs)) newData.logs = [newData.logs];
		newData.logs = newData.logs.concat(oldData[0].logs);
		await db.update("trades", { id: this.id }, newData);
		return;
	}

	// execute the trade, and make it a pending order
	async execute(reexecuted) {
		try {
			let buy = await this.buyPosition.execute(this.#mt.lastPrice[this.symbol]);
			let sell = await this.sellPosition.execute(
				this.#mt.lastPrice[this.symbol]
			);

			this.#mt.positionTradeMap[buy.id] = this;
			this.#mt.positionTradeMap[sell.id] = this;

			await this.changeState("executed");

			// TODO: instead of "this.checkPosition", there should be linked to the events
			// Checking positions to remove the opposite when the first one is placed,
			// and to update stoploss
			this.checkPositions();

			return;
		} catch (err) {
			if (reexecuted) return;
			console.log("error has happened while executing a trade!: ", err);
			await this.close("rejected", {
				error: err,
				discription: "error has happened while executing a trade!",
			});

			setTimeout(async () => {
				try {
					await this.execute(true);
				} catch (err) {
					console.log("error has happened while re-executing a trade!: ", err);
					await this.close("rejected", {
						error: err,
						discription: "error has happened while re-executing a trade!",
					});
					return;
				}
			}, 2000);
			throw err;
		}
	}

	// TODO: instead, it should be linked with the events directly
	// Checking positions to remove the opposite when the first one is placed,
	// and to update stoploss
	async checkPositions() {
		this.buyPosition.check();
		this.sellPosition.check();
	}

	async close(state, log) {
		// TODO: closing two positions is somehow not approperiate, I should know what the opened position is to close it only
		if (state) await this.changeState(state);
		if (log) await this.updateDB({ logs: log });
		try {
			await this.sellPosition.close();
			await this.buyPosition.close();
		} catch (err) {
			console.log(`couldn't close the trade because of: `);
			console.error(err);
			await this.updateDB({ logs: err });
		}

		// TODO: check if I add "this", would it be valid, or should I make it into a separated object.
		await this.updateDB(this);
		return;
	}

	// calculate gaps in pips
	async gapCalculate() {
		if (this.gapType == "pips") {
			let metaData = await db.read("symbols", {
				symbol: this.symbol,
			});
			let pipSize = metaData[0].pipSize;

			console.log({ metaData, pipSize });
			this.calculatedGap = this.gap * pipSize;
			return;
		} else if (this.gapType == "average") {
			// TODO: getting the candle average of 30 minutes and multiplies it with the gap value.
		}
	}
}

class Position {
	#trade;
	#oppositePosition;

	// all the positions are pending positions.
	constructor({ trade, type }) {
		this.#trade = trade;
		this.type = type;
		this.secured = false; // secured is the statement where the SL is set to BE
	}

	async execute(marketPrice) {
		let bidPrice = marketPrice.bid;
		let askPrice = marketPrice.ask;
		this.#trade.volume = await this.calculateVolume(marketPrice);
		// console.log(
		// 	`Bid Price: ${bidPrice}, Ask Price: ${askPrice}, volume: ${
		// 		this.#trade.volume
		// 	}`
		// );
		try {
			let order;
			if (this.type == "buy") {
				console.log(
					"buy position: ",
					this.#trade.symbol,
					this.#trade.volume,
					askPrice + this.#trade.calculatedGap,
					bidPrice - this.#trade.calculatedGap
				);
				order = await this.#trade
					.MT()
					.MTConnection()
					.createStopBuyOrder(
						this.#trade.symbol,
						this.#trade.volume,
						askPrice + this.#trade.calculatedGap,
						bidPrice - this.#trade.calculatedGap
					);
			} else if (this.type == "sell") {
				console.log(
					"sell position: ",
					this.#trade.symbol,
					this.#trade.volume,
					bidPrice - this.#trade.calculatedGap,
					askPrice + this.#trade.calculatedGap
				);
				order = await this.#trade
					.MT()
					.MTConnection()
					.createStopSellOrder(
						this.#trade.symbol,
						this.#trade.volume,
						bidPrice - this.#trade.calculatedGap,
						askPrice + this.#trade.calculatedGap
					);
			}
			this.id = order.orderId;
			console.log({ order, positionID: this.id });
			// console.log(this.order)

			console.log("Trade successful, result code is " + this.order);
			return this.order;
		} catch (err) {
			console.log("Trade failed with result code " + err);
			console.error(err);
			this.#trade.close("rejected", err);
			throw err;
		}
	}

	async calculateVolume(marketPrice) {
		let type = this.type == "buy" ? "ORDER_TYPE_BUY" : "ORDER_TYPE_SELL";
		let openPrice = this.type == "buy" ? marketPrice.ask : marketPrice.bid;

		//TODO: I should check if the trades are fully closed, so the equity is not affected, because if another trade is opened while this trade is executed, the equity would not be the same, and it may cause problems starting the trade
		// let equity = marketPrice.equity;
		let metaData = await db.read("metadata", { username: "mohammedalrawi" });
		let freeMargin = metaData[0].freeMargin;
		let margin;

		// TODO: checking if there is a problem calculating the margin in the next block of code, because it was causing some incorrect results before using the sockets

		// calculating the margin required for this
		try {
			let tMargin = await this.#trade.MT().MTConnection().calculateMargin({
				type,
				symbol: this.#trade.symbol,
				volume: 1,
				openPrice,
			});
			margin = tMargin.margin;
		} catch (err) {
			console.error(err);
			throw err;
		}

		console.log(
			`volume error checking: openPrice: ${openPrice}, freeMargin: ${freeMargin}, margin: ${margin}`
		);
		switch (this.#trade.symbol) {
			case "XAUUSD.c":
				margin = margin / openPrice;
				break;
			default:
				margin = margin;
				break;
		}
		console.log("margin after editing: ", margin);
		let volume =
			Math.round((freeMargin / margin) * this.#trade.marginPercentage) / 100;
		console.log({ volume });
		return volume;
	}

	// TODO: that should be done directly with events instead
	// check for updating
	async check() {
		console.log("checking position");
		this.checkIfCanceled();
		if ((this.state != "pending") | (this.state == "canceled")) {
			return;
		} else if (this.#oppositePosition.state == "canceled") {
			this.secure();
			this.trackSL();
			return;
		}

		if (!this.order.positionId) {
			try {
				// if the order doesn't have a positionId then the order hasn't been updated yet.
				let pendingOrder = await this.#trade
					.MT()
					.MTConnection()
					.getOrder(this.order.orderId);
				this.order = pendingOrder;
			} catch (err) {
				console.log("cannot convert initialized order to pending order!");
				console.log(err);
			}
			await this.check();
			return;
		} else {
			console.log("order has a positionID: ", this.order.positionId);
		}

		try {
			// check if the position has been initialized
			let positionResult = await this.#trade
				.MT()
				.MTConnection()
				.getPosition(this.order.positionId);
			this.position = positionResult;
			await this.#oppositePosition.close();
			this.check();
		} catch (err) {
			console.log("position update failed with error: ", err);
			// if (!err.includes('NotFoundError: Position with specified id not found')) {
			//   console.log(err)
			// }
			setTimeout(() => {
				this.check();
			}, 1000);
		}
	}

	assignOppositePosition(oppositePosition) {
		this.#oppositePosition = oppositePosition;
	}

	// TODO: this should be re organized as the trade should be secured after it profits for 5 seconds continously,
	async secure() {
		this.checkIfCanceled();
		if (this.state == "canceled") {
			return;
		}

		if (this.secured) {
			console.log("trying to secure position but it's already been secured!");
			return;
		}

		if (
			(this.type == "buy" &&
				this.position.profit > 0 &&
				this.position.stopLoss < this.position.currentPrice) ||
			(this.type == "sell" &&
				this.position.profit > 0 &&
				this.position.stopLoss > this.position.currentPrice)
		) {
			console.log("trying to secure position");
			try {
				let securingModify = await this.modify(this.position.openPrice);
				console.log({ securingModify });
				this.secured = true;
				console.log("position is secured properly");
				return;
			} catch (err) {
				console.log("position couldn't be secured because: ", err);
				return;
			}
		}

		// TODO: the position should be updated automatically with events, there is no need to set a timer to track it
		setTimeout(async () => {
			try {
				console.log("updating position to secure it");
				let updatedPosition = await this.updatePosition();
				this.secure();
				return;
			} catch (err) {
				console.log("couldn't update position to secure it");
			}
		}, 3000);
	}

	// TODO: most of this code should be removed because the information should be got from the events directly
	// TODO: making statments for all the trades (pending, executed, running, timeout, canceled, completed, rejected)
	// TODO: pending orders have the same ids of the positions, but I shoudl determine if the order is there or has been changed to a postion. that is to know whether my call should cancel the order or close the position.
	async checkIfCanceled() {
		if (this.state == "canceled") {
			return true;
		} else if (this.state == "position") {
			try {
				await this.#trade.MT().MTConnection().getPosition(this.position.id);
				return false;
			} catch (err) {
				console.log(err);
				try {
					this.deal = await this.#trade
						.MT()
						.MTConnection()
						.getDealsByPosition(this.position.id);
					if (this.deal.deals.length == 2) {
						this.state = "canceled";
						return true;
					} else if (this.deal.deals.length == 1) {
						return false;
					}
				} catch (err) {
					console.log("couldn't check deals because: ", err);
					return false;
				}
			}
		} else if (this.state == "pending") {
			try {
				console.log("checking if order is deleted");
				await this.#trade
					.MT()
					.MTConnection()
					.getOrder(this.order.id ? this.order.id : this.order.orderId);
				console.log("order is not deleted!");
				return false;
			} catch (err) {
				console.log("couldn't get the order by order id because: ");
				console.log(err);
				try {
					await this.#trade
						.MT()
						.MTConnection()
						.getPosition(this.order.positionId);
					return false;
				} catch (err) {
					this.state = "canceled";
					return true;
				}
			}
		}
	}

	// TODO: this should be checked whether it is needed or not, because the information of a position should be updated directly from the events
	// for updating the properties after it's been placed as a position
	async updatePosition() {
		try {
			this.position = await this.#trade
				.MT()
				.MTConnection()
				.getPosition(this.position.id);
			console.log("position udpated successfully");
			this.state = "position";
			return this.position;
		} catch (err) {
			console.log("position update failed: ", err);
			this.checkIfCanceled();
			throw err;
		}
	}

	// TODO: if it works fine, I think it is OK. But if the structure is differenet using the sockets, then it should be checked
	async modify(stopLoss, takeProfit) {
		try {
			console.log(`modifyingPosition: ${{ stopLoss, takeProfit }}`);
			if (
				(this.type == "buy" && stopLoss < this.position.stopLoss) ||
				(this.type == "sell" && stopLoss > this.position.stopLoss)
			)
				return;

			await this.#trade
				.MT()
				.MTConnection()
				.modifyPosition(this.position.id, stopLoss, takeProfit);
			return;
		} catch (err) {
			throw err;
		}
	}

	// TODO: checking if the position has been placed is a depricated method, because it should be known directly from the events
	// check if the order has been placed, if so, then close position by ID, else cancel the order.
	async close(opposite) {
		if (opposite) {
			this.#trade.MT().MTConnection().cancelOrder(this.id);
			return;
		}
		switch (this.#trade.state) {
			case "pending":
				this.#trade.changeState("canceled");
				break;
			case "executed":
				this.#trade.MT().MTConnection().cancelOrder(this.id);
				break;
			case "timeout":
				this.#trade.MT().MTConnection().cancelOrder(this.id);
				break;
			case "rejected":
				this.#trade.MT().MTConnection().cancelOrder(this.id);
				break;
			case "running":
				this.#trade.MT().MTConnection().closePosition(this.id);
				this.#trade.changeState("completed");
				break;
			case "completed":
				this.#trade.MT().MTConnection().closePosition(this.id);
				break;
			case "canceled":
				// TODO: there should not be canceled state added inside Trade, it should be always stated above
				break;
		}

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
	}

	// for tracking and setting the stoploss to a specified point, so the trade would be profitable when it hits the stoploss
	async trackSL() {
		// TODO: needs to be changed according to sockets
		let s = schedule.scheduleJob("*/1 * * * *", async () => {
			if (this.state == "canceled") {
				console.log(`stopping node schedular on trackSL ${this.type}`);
				s.cancel();
				return;
			}

			if (!this.minutePrice.length) {
				await this.udpateMinutePrice();
				return;
			}

			let trailingMinutes = 3;
			if (this.minutePrice.length >= trailingMinutes) {
				console.log(
					"modifying ",
					this.type,
					" trackSL: ",
					this.minutePrice[this.minutePrice.length - trailingMinutes]
				);
				await this.modify(
					this.minutePrice[this.minutePrice.length - trailingMinutes]
				);
			} else {
				await this.modify(this.minutePrice[0]);
			}
			await this.udpateMinutePrice();
		});
	}

	async udpateMinutePrice() {
		await this.updatePosition();
		this.minutePrice.push(this.position.currentPrice);
	}
}

module.exports = { MT, Trade, Position };
