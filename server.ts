import { createServer } from 'node:http'
import next from 'next'
import { Server } from 'socket.io'
import socketEventHandler from './socket.server'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.VERCEL_URL || 'localhost'
const port = Number(process.env.VERCEL_PORT || '3000')

const app = next({ dev, hostname, port })
const handler = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer(handler)
  const io = new Server(httpServer)

  socketEventHandler(io)

  httpServer
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
    })
})
