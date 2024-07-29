const zmq = require("zeromq");

let port = 5522;

async function run() {
	const sock = new zmq.Pull();

	sock.connect(`tcp://127.0.0.1:${port}`);
	console.log("Worker connected to port ", port);

	for await (const [msg] of sock) {
		console.log("work");
	}
}

run().catch(console.error);
