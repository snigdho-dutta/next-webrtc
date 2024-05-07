'use client'
import { useEffect, useState } from 'react'
import { useSocket } from '../../context/socket.context'
import { socket } from '../socket'
import InfoCard from './InfoCard'
import { useRouter } from 'next/navigation'
import RoomInput from './RoomInput'

const SharePage = () => {
  const { isConnected, transport, socketId, username, setUsername } =
    useSocket()

  const router = useRouter()
  const createRoom = ({
    username,
    roomName,
  }: {
    username: string
    roomName: string
  }) => {
    if (!username.trim()) {
      alert('Please enter username')
      return
    }
    socket.emit('create_room', { roomId: roomName, username })
  }
  const joinRoom = ({ username, roomName }) => {
    if (!username.trim()) {
      alert('Please enter username')
      return
    }
    socket.emit('join_room', { roomId: roomName, username })
  }
  useEffect(() => {
    socket.on('room_exists', () => {
      alert('Room already exists')
    })
    socket.on('no_room', () => {
      alert('Room not found')
    })
    socket.on('room_created', ({ roomId }) => {
      alert('Room created')
      router.push(`/share/${roomId}`)
    })
    socket.on('room_joined', ({ roomId }) => {
      alert('Joined room')
      router.push(`/share/${roomId}`)
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
      <InfoCard
        {...{ isConnected, transport, socketId, username, setUsername }}
      />
      <div className='flex gap-2 items-center'>
        <div className='flex flex-col  self-center justify-center w-full'>
          <RoomInput createRoom={createRoom} joinRoom={joinRoom} />
        </div>
      </div>
    </div>
  )
}

export default SharePage
