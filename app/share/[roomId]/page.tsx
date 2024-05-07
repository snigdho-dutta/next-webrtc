'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { socket } from '../../socket'
import { useParams } from 'next/navigation'
import { WebRTCPeer } from '../../peer'
import { receiveFile, sendFile } from '../../../utils/helpers'

type Props = {}

const SharePage = (props: Props) => {
  const [roomUsers, setRoomUsers] = useState<
    { id: string; username: string }[]
  >([])
  const [file, setFile] = useState<File>()
  const [connectionStatus, setConnectionStatus] = useState('')
  const peerRef = useRef<WebRTCPeer>()
  const roomId = useParams().roomId as string

  const createDataChannel = async (socketId: string) => {
    const peer: WebRTCPeer = new WebRTCPeer({
      on_ice: onIceCandidate,
      on_connection_state_change: (e) =>
        setConnectionStatus(peer.getPeerConnection().connectionState || ''),
      on_data_channel: onDataChannel,
    })

    peer.createDataChannel(roomId)
    window.peer = peerRef.current = peer
    peer.getDataChannel()!.onmessage = (ev) => {
      const { data } = ev
      if (data === 'RECEIVED') {
        setFile(undefined)
        // clean memory
      }
    }
    peer.getPeerConnection().ondatachannel = onDataChannel
    await peer.createOffer().then((offer) => {
      socket.emit('offer', {
        offer,
        socketId,
      })
    })
  }

  const onIceCandidate = useCallback(
    async (candidate: RTCIceCandidate) => {
      if (!peerRef.current) return
      // if (!peerRef.current.getPeerConnection().remoteDescription) return
      // await peerRef.current.addIceCandidate(candidate)
      socket.emit('ice-candidate', {
        candidate,
        socketId: roomId,
      })
    },
    [roomId]
  )

  const onDataChannel = (event: RTCDataChannelEvent) => {
    console.log('got data channel')
    if (!peerRef.current) return
    peerRef.current.setDataChannel(event.channel)
    // receiveFile(event.channel)
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
        window.peer = peerRef.current = new WebRTCPeer({
          on_ice: onIceCandidate,
          on_connection_state_change: (e) =>
            setConnectionStatus(
              peerRef.current?.getPeerConnection().connectionState || ''
            ),
          on_data_channel: onDataChannel,
        })

        await peerRef.current.acceptOffer(offer).then((answer) => {
          socket.emit('offer_accepted', {
            answer,
            socketId,
          })
        })
      })
      socket.on('answer', async ({ answer, socketId }) => {
        if (socket.id === socketId) return
        await peerRef.current?.acceptAnswer(answer)
      })
      socket.on('ice-candidate', async ({ candidate, socketId }) => {
        if (socket.id !== socketId) {
          await peerRef.current!.addIceCandidate(candidate)
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
        {roomUsers.map(({ id, username }) => (
          <div
            key={id}
            className={`${
              id === socket.id
                ? 'absolute z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-500 border border-dashed p-2'
                : 'rounded-full bg-emerald-600 w-24 h-24 grid place-items-center'
            }`}
          >
            {id === socket.id ? (
              <div className='flex flex-col gap-2'>
                <input
                  type='file'
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      window.file = file
                      setFile(file)
                    } else {
                      setFile(undefined)
                      window.file = undefined
                    }
                  }}
                  className='p-2 text-white rounded-md w-full'
                />
                <button
                  onClick={() => {
                    // sendFile(file!, peerRef.current!.getDataChannel()!)
                    peerRef.current && file && peerRef.current.sendFile(file)
                  }}
                >
                  Send
                </button>
              </div>
            ) : (
              <div className='flex flex-col p-1'>
                {connectionStatus !== 'connected' && (
                  <button
                    className='self-center font-bold text-lg'
                    onClick={() => createDataChannel(id)}
                  >
                    +
                  </button>
                )}
                <p>{connectionStatus}</p>

                <p className='text-white font-semibold text-center'>
                  {username}
                </p>
              </div>
            )}
          </div>
        ))}
        <div className=''>
          <button
            onClick={() => {
              console.log(peerRef.current?.getPeerConnection())
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
