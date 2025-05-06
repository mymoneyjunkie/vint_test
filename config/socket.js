import { createRequire } from "module";

const require = createRequire(import.meta.url);

import dbConnectionPromise from "./db.js";

const deviceToSocketMap = new Map();

let io;

const socketIO = {
    init: httpServer => {
        io = require('socket.io')(httpServer, {
            cors: {
                origin: "*",
                methods: ["GET", "POST", "PUT", "DELETE"]
            }
        });
      
        io.on('connection', async (socket) => {
            // console.log('Client connected:', socket.id);

            const dbConnection = await dbConnectionPromise;

            socket.on('register', async ({ deviceID }) => {
                try {
                    // console.log("deviceID: ", deviceID);
                    const selectQuery = `SELECT device_id from users WHERE device_id = ?`;
                    const response2 = await dbConnection.query(selectQuery, [deviceID]);
                  
                    // console.log(response2);
                  
                    if (!response2) {
                        const error1 = new Error("operation failed.");
                        error1.statusCode = 400;
                        throw error1;
                    }
                  
                    else if (response2[0][0]?.device_id != undefined) {
                      deviceToSocketMap.set(deviceID, socket.id);
                      socket.join(deviceID);
                    }
                  
                    else {
                      const insertQuery = "INSERT INTO users (`device_id`) VALUES (?)";
                      const response1 = await dbConnection.query(insertQuery, [deviceID]);

                      if (!response1) {
                          const error1 = new Error("Operation failed.");
                          error1.statusCode = 400;
                          throw error1;
                      }

                      else {
                          // console.log("Device registered:");
                          deviceToSocketMap.set(deviceID, socket.id);
                          socket.join(deviceID);
                          // console.log(deviceToSocketMap);
                      }
                    }
                } catch (err) {
                    // console.log("Error registering device:", err);
                    socket.emit("error", { message: "Failed to register device." });
                }
            });

            socket.on('disconnect', () => {
                for (const [deviceID, socketId] of deviceToSocketMap.entries()) {
                    if (socketId === socket.id) {
                        deviceToSocketMap.delete(deviceID);
                        // console.log(`Removed device ${deviceID} from map due to disconnect.`);
                        break;
                    }
                }

                // console.log("Client disconnected:", socket.id);
            });
        });
        
        return io;
    },
  
    getIO: () => {
        if (!io) {
            throw new Error("Socket.io not initialized!");
        }
        return io;
    }
};

export default socketIO;
export { deviceToSocketMap };