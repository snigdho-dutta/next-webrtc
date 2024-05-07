"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const next_1 = __importDefault(require("next"));
const socket_io_1 = require("socket.io");
const socket_server_1 = __importDefault(require("./socket.server"));
const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.VERCEL_URL || 'localhost';
const port = Number(process.env.VERCEL_PORT || '3000');
const app = (0, next_1.default)({ dev, hostname, port });
const handler = app.getRequestHandler();
app.prepare().then(() => {
    const httpServer = (0, node_http_1.createServer)(handler);
    const io = new socket_io_1.Server(httpServer);
    (0, socket_server_1.default)(io);
    httpServer
        .once('error', (err) => {
        console.error(err);
        process.exit(1);
    })
        .listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});
