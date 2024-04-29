'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { socket } from '../../socket'
import { useParams } from 'next/navigation'
import {
  WebRTCPeer,
  receiveFile,
  receiveFile2,
  sendFile,
  sendFile2,
} from '../../peer'

type Props = {}

const SharePage = (props: Props) => {
  const [roomUsers, setRoomUsers] = useState<string[]>([])
  const [file, setFile] = useState<File>()
  const peerRef = useRef<WebRTCPeer>()
  const dataChanelRef = useRef<RTCDataChannel>()
  const roomId = useParams().roomId as string

  const createDataChannel = async (socketId: string) => {
    peerRef.current = new WebRTCPeer(onIceCandidate, () => {})
    peerRef.current.createDataChannel(roomId)
    peerRef.current.getDataChannel().onmessage = (ev) => {
      const { data } = ev
      console.log(data)
    }
    peerRef.current.getPeerConnection().ondatachannel = onDataChannel
    await peerRef.current.createOffer().then((offer) => {
      socket.emit('offer', {
        offer,
        socketId,
      })
    })
  }

  const onIceCandidate = useCallback(
    async (candidate: RTCIceCandidate) => {
      if (!peerRef.current.getPeerConnection().remoteDescription) return
      await peerRef.current.addIceCandidate(candidate)
      socket.emit('ice-candidate', {
        candidate,
        socketId: roomId,
      })
    },
    [roomId]
  )

  const onDataChannel = (event: RTCDataChannelEvent) => {
    console.log('got data channel')
    // dataChanelRef.current = event.channel
    // receiveFile2(event.channel)
    peerRef.current.setDataChannel(event.channel)
    peerRef.current.receiveFile((progress) => {
      console.log('progress', progress)
    })
  }

  useEffect(() => {
    if (socket.connected) {
      socket.emit('get_room_users', { roomId })
      socket.on('room_users', (users) => {
        setRoomUsers(users)
      })
      socket.on('offer_request', async ({ offer, socketId }) => {
        peerRef.current = new WebRTCPeer(onIceCandidate, () => {})
        peerRef.current.getPeerConnection().ondatachannel = onDataChannel
        await peerRef.current.acceptOffer(offer).then((answer) => {
          socket.emit('offer_accepted', {
            answer,
            socketId,
          })
        })
      })
      socket.on('answer', async ({ answer, socketId }) => {
        await peerRef.current.acceptAnswer(answer)
      })
      socket.on('ice-candidate', async ({ candidate, socketId }) => {
        if (peerRef.current?.getPeerConnection().remoteDescription) {
          await peerRef.current.addIceCandidate(candidate)
          console.log('added ice candidate')
        }
      })
    }
    return () => {
      socket.off('room_users')
      socket.off('offer_request')
      socket.off('answer')
      socket.off('ice-candidate')
    }
  }, [onIceCandidate, roomId])

  return (
    <div className='flex flex-col p-2 gap-2 w-full h-full'>
      <h1 className='text-3xl text-center flex justify-center items-center gap-2'>
        Welcome to
        <span className='font-bold text-purple-500 underline py-1 px-4 rounded-md grid place-items-center'>
          {' '}
          {roomId}
        </span>
      </h1>
      <div className='flex gap-5 relative h-full flex-1 w-full p-5'>
        {roomUsers.map((user) => (
          <div
            key={user}
            className={`${
              user === socket.id
                ? 'absolute z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-500 border border-dashed p-2'
                : 'rounded-full bg-emerald-600 w-24 h-24 grid place-items-center'
            }`}
          >
            {user === socket.id ? (
              <div className='flex flex-col gap-2'>
                <input
                  type='file'
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setFile(file)
                    }
                  }}
                  className='p-2 text-white rounded-md w-full'
                />
                <button onClick={() => peerRef.current.sendFile(file)}>
                  Send
                </button>
              </div>
            ) : (
              <div className='flex flex-col p-1'>
                <button onClick={() => createDataChannel(user)} className=''>
                  Connect
                </button>
                <button onClick={() => receiveFile(dataChanelRef.current)}>
                  Receive
                </button>
              </div>
            )}
          </div>
        ))}
        <div className=''>
          <button
            onClick={() => {
              console.log(peerRef.current.getPeerConnection())
            }}
          >
            Show
          </button>
        </div>
      </div>
    </div>
  )
}

export default SharePage
