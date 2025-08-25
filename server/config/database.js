import { createMongoStorage, setStorage } from "../models/storage.js";
import { log } from "../utils/logger.js";

export async function initializeStorage() {
  try {
    const mongoStorage = await createMongoStorage();
    setStorage(mongoStorage);
    log("MongoDB storage initialized successfully");
    return mongoStorage;
  } catch (error) {
    log(`MongoDB connection failed: ${error.message}`);
    log("This appears to be an SSL/TLS compatibility issue with MongoDB Atlas");
    log("Please check your MongoDB Atlas cluster settings or try a different provider");
    throw error;
  }
}