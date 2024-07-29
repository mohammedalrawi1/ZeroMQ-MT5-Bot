const zmq = require("zeromq")

let testReq = {
  method: "UNSUB",
  action: "CLOSE",
  type: "BUYSTOP",
  symbol: "EURUSD",
  price: 2250.02,
  sl: 0,
  tp: 0,
  volume: 0.01,
  ticket: "3198785",
  partialClosePercentage: 0.6
}

async function run() {
  const sock = new zmq.Request

  await sock.connect("tcp://127.0.0.1:5551")
  console.log("Producer bound to port 5551")

  let req = JSON.stringify(testReq);
  console.log(req)

  await sock.send(req)
  let [result] = await sock.receive();
  let jsonResult = JSON.parse(result.toString())
  console.log(jsonResult)

  // while (true) {
  //   await sock.send("Hello")
  //   console.log("Hello is sent.")
  //   await new Promise(resolve => { setTimeout(resolve, 500) })
  //   let [result] = await sock.receive();
  //   console.log(result.toString())
  // }

}

run()
