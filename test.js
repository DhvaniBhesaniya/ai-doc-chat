import dotenv from "dotenv";
dotenv.config();

import { pineconeStore } from "./server/services/pineconeStore.js";



pineconeStore.deleteVectorsByDocumentName("one_piece_unique_info.pdf");





