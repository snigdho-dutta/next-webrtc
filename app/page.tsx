'use client'
import { socket } from './socket'
import { useRouter } from 'next/navigation'
import { useSocket } from '../context/socket.context'
import { WebRTCPeer } from './peer'
declare global {
  interface Window {
    peer?: WebRTCPeer
    arrayBuffer?: ArrayBuffer
    file?: File
  }
}

export default function Home() {
  const { isConnected, transport, socketId, username, setUsername, users } =
    useSocket()

  const router = useRouter()

  return (
    <div className='flex flex-col w-full h-full bg-slate-900 gap-5 p-2 justify-between items-center'>
      <div className='self-start flex gap-4 p-4 bg-slate-400'>
        <div className=''>
          <p>Status: {isConnected ? 'connected' : 'disconnected'}</p>
          <p>Transport: {transport}</p>
          <p>Socket ID: {socketId}</p>
          <p>Username: {username}</p>
        </div>
        <div>
          <input
            onChange={({ target: { value } }) => {
              if (value) {
                setUsername(value)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                socket.emit('update_username', { id: socketId, username })
              }
            }}
            className='p-2 rounded text-black font-semibold outline-none'
            type='text'
            placeholder='Enter username'
          />
        </div>
      </div>
      <div className='border flex-1 w-full h-max p-2 flex flex-col gap-2'>
        <h1>Active Users</h1>
        <div className='flex flex-col flex-wrap gap-4 rounded-lg'>
          {users
            .filter(([id, name]) => id !== socketId)
            .map(([id, name]) => (
              <div
                className='rounded-lg border p-4 hover:shadow-xl max-w-[300px] w-full text-center justify-center self-center shadow-white hover:scale-105 duration-200'
                key={id}
                onClick={() => router.push(`/chat/${id}`)}
              >
                {name}
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
