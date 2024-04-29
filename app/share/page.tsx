'use client'
import { useEffect, useState } from 'react'
import { useSocket } from '../../context/socket.context'
import { socket } from '../socket'
import InfoCard from './InfoCard'
import { useRouter } from 'next/navigation'

const SharePage = () => {
  const { isConnected, transport, socketId, username, setUsername } =
    useSocket()
  const [createRoomName, setCreateRoomName] = useState('')
  const [joinRoomName, setJoinRoomName] = useState('')
  const router = useRouter()
  const createRoom = () => {
    socket.emit('create_room', { roomId: createRoomName })
  }
  const joinRoom = () => {
    socket.emit('join_room', { roomId: joinRoomName })
  }
  useEffect(() => {
    socket.on('room_exists', () => {
      alert('Room already exists')
    })
    socket.on('no_room', () => {
      alert('Room not found')
    })
    socket.on('room_created', () => {
      alert('Room created')
      router.push(`/share/${createRoomName}`)
    })
    socket.on('room_joined', () => {
      alert('Joined room')
      router.push(`/share/${joinRoomName}`)
    })

    return () => {
      socket.off('room_exists')
      socket.off('room_created')
      socket.off('room_joined')
      socket.off('no_room')
    }
  })

  return (
    <div className='flex flex-col p-2 gap-2'>
      <h1 className='text-3xl font-bold text-center'>
        Peer to peer file sharing
      </h1>
      <div className='flex gap-2 items-center'>
        <InfoCard
          {...{ isConnected, transport, socketId, username, setUsername }}
        />
        <div className='p-2 flex flex-col gap-2'>
          <input
            type='text'
            value={createRoomName}
            onChange={({ target: { value } }) => setCreateRoomName(value)}
            className='p-2 rounded bg-slate-700'
            placeholder='Enter room name'
          />
          <button
            className='p-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg'
            onClick={createRoom}
          >
            Create Room
          </button>
        </div>
        <div className='p-2 flex flex-col gap-2'>
          <input
            type='text'
            value={joinRoomName}
            onChange={({ target: { value } }) => setJoinRoomName(value)}
            className='p-2 rounded bg-slate-700'
            placeholder='Enter room name'
          />
          <button
            className='p-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg'
            onClick={joinRoom}
          >
            Join Room
          </button>
        </div>
      </div>
    </div>
  )
}

export default SharePage
