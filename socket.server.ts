import { Server } from 'socket.io'
import { socket } from './app/socket'
const users = new Map()
const rooms: Map<string, Set<string>> = new Map()
const usernames: Map<string, string> = new Map()

const socketEventHandler = (io: Server) => {
  io.on('connection', (socket) => {
    console.log('a user connected', socket.id)
    users.set(socket.id, 'anonymous')
    io.emit('users', Array.from(users.entries()))

    socket.on('get_users', () => {
      io.emit('users', Array.from(users.entries()))
    })

    socket.on('update_username', ({ id, username }) => {
      users.set(id, username)
      io.emit('users', Array.from(users.entries()))
    })

    socket.on('disconnect', () => {
      console.log('a user disconnected', socket.id)
      users.delete(socket.id)
      io.emit('users', Array.from(users.entries()))
      rooms.forEach((users, roomId) => {
        if (users.has(socket.id)) {
          users.delete(socket.id)
          usernames.delete(socket.id)
          io.to(roomId).emit(
            'room_users',
            Array.from(rooms.get(roomId) || []).map((id) => {
              return { id, username: usernames.get(id) }
            })
          )
        }
      })
    })
    // Room events
    socket.on(
      'create_room',
      ({ roomId, username }: { username: string; roomId: string }) => {
        if (rooms.has(roomId)) {
          socket.emit('room_exists')
          return
        }
        socket.join(roomId)
        rooms.set(roomId, new Set<string>().add(socket.id))
        usernames.set(socket.id, username)
        console.log('room created', roomId)
        socket.emit('room_created', { roomId })
      }
    )

    socket.on('join_room', ({ roomId, username }) => {
      if (rooms.has(roomId)) {
        if (rooms.get(roomId)?.has(socket.id)) return
        socket.join(roomId)
        rooms.get(roomId)?.add(socket.id)
        usernames.set(socket.id, username)
        console.log('room joined', roomId)
        socket.emit('room_joined', { roomId })
        io.to(roomId).emit(
          'room_users',
          Array.from(rooms.get(roomId) || []).map((id) => {
            return { id, username: usernames.get(id) }
          })
        )
      } else {
        socket.emit('no_room')
      }
    })

    socket.on('get_room_users', ({ roomId }) => {
      if (rooms.has(roomId)) {
        socket.emit(
          'room_users',
          Array.from(rooms.get(roomId) || []).map((id) => {
            return { id, username: usernames.get(id) }
          })
        )
      }
    })

    // WebRTC events
    socket.on('offer', ({ socketId, offer }) => {
      console.log('got offer')
      io.to(socketId).emit('offer_request', { socketId: socket.id, offer })
    })

    socket.on('offer_accepted', ({ socketId, answer }) => {
      console.log('got answer')
      io.to(socketId).emit('answer', { socketId: socket.id, answer })
    })
    socket.on('ice-candidate', ({ socketId, candidate }) => {
      console.log('got ice candidate')
      io.to(socketId).emit('ice-candidate', { candidate, socketId: socket.id })
    })
  })
}
export default socketEventHandler
