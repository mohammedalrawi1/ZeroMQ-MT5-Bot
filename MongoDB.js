const { MongoClient } = require("mongodb");

class MongoDB {
  #client;
  #name;
  constructor(name, uri) {
    console.log("this point");
    this.#client = new MongoClient(uri);
    this.#name = name;
    this.connectToDatabase();

    // to console.log when the database is closed
    process.on("SIGINT", () => {
      this.#client.close().then(() => {
        console.log("MongoDB connection closed");
        process.exit(0);
      });
    });
  }

  // connect to the database
  async connectToDatabase() {
    try {
      await this.#client.connect();
      console.log("Connected to MongoDB");
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async create(collection, obj = {}, indexed) {
    collection = this.getCollectionByName(collection);

    try {
      if (indexed) {
        obj.id = (await getLatestID(collection)) + 1;
      }
      const result = await collection.insertOne(obj);
      console.log("Added to the database: ", result);
      return obj.id ? obj.id : result;
    } catch (err) {
      console.error("error when adding an object to the database: ", err);
      throw err;
    }

    async function getLatestID(collection) {
      try {
        let result = await collection
          .find()
          .sort({ id: -1 })
          .limit(1)
          .toArray();
        if (result.length > 0) {
          return result[0].id;
        } else {
          return 0;
        }
      } catch (err) {
        console.error(err);
        throw err;
      }
    }
  }

  getCollectionByName(collection) {
    return this.#client.db(this.#name).collection(collection);
  }

  async read(collection, obj = {}) {
    collection = this.getCollectionByName(collection);
    try {
      let result = await collection.find(obj).toArray();
      return result;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async readLimit(collection, obj = {}, limit = 20, skip = 0) {
    collection = this.getCollectionByName(collection);
    try {
      let result = await collection
        .find(obj)
        .sort({ id: -1 }) // Sort by _id in descending order
        .skip(skip) // Skip the first 'skip' documents
        .limit(limit) // Limit the number of documents to 'limit'
        .toArray();
      return result;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async update(collection, obj = {}, modified = {}) {
    collection = this.getCollectionByName(collection);
    try {
      let result = await collection.updateOne(obj, { $set: modified });
      return result;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async delete(collection, obj = {}) {
    collection = this.getCollectionByName(collection);
    try {
      let result = await collection.deleteOne(obj);
      console.log("deleted");
      console.log(obj);
      return result;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
}

module.exports = MongoDB;
// let db = new MongoDB('metaapi', 'mongodb://127.0.0.1:27017')
