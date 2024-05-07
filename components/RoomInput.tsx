'use client'
import React, { useState } from 'react'
import { uid } from '../utils/helpers'
type Args = {
  username: string
  roomName: string
}
type Props = {
  createRoom: ({ roomName, username }: Args) => void
  joinRoom: ({ roomName, username }: Args) => void
}

const RoomInput = ({ createRoom, joinRoom }: Props) => {
  const [username, setUsername] = useState('')
  const [createRoomName, setCreateRoomName] = useState('')
  const [joinRoomName, setJoinRoomName] = useState('')
  const generateRommName = () => {
    setCreateRoomName(uid())
  }
  return (
    <div className='p-2 flex flex-col gap-2'>
      <div className='flex items-center gap-2 self-center border p-2 rounded-lg'>
        <p className='text-md font-semibold'>Username</p>
        <input
          className='p-2 rounded bg-slate-700 min-w-[300px]'
          type='text'
          placeholder='Enter username'
          value={username}
          onChange={({ target: { value } }) => setUsername(value)}
        />
      </div>
      <div className='flex w-full gap-4'>
        <div className='w-1/2 p-2 border rounded-lg gap-2 flex flex-col'>
          <div className='flex gap-1 self-stretch'>
            <input
              className='p-2 rounded bg-slate-700 w-full'
              type='text'
              value={createRoomName}
              onChange={({ target: { value } }) => setCreateRoomName(value)}
              placeholder='Enter room name'
            />
            <button
              className='p-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg'
              onClick={generateRommName}
            >
              Generate
            </button>
          </div>
          <button
            className='p-2 self-center bg-emerald-600 hover:bg-emerald-500 rounded-lg'
            onClick={createRoom.bind(null, {
              username,
              roomName: createRoomName,
            })}
          >
            Create
          </button>
        </div>
        <div className='w-1/2 p-2 gap-2 border rounded-lg flex flex-col'>
          <input
            className='p-2 rounded bg-slate-700 w-full'
            type='text'
            value={joinRoomName}
            onChange={({ target: { value } }) => setJoinRoomName(value)}
            placeholder='Enter room name'
          />
          <button
            className='p-2 px-4 self-center bg-emerald-600 hover:bg-emerald-500 rounded-lg'
            onClick={joinRoom.bind(null, { username, roomName: joinRoomName })}
          >
            Join
          </button>
        </div>
      </div>
    </div>
  )
}

export default RoomInput
