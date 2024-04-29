'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { WebRTCPeer } from '../../peer'
import { useParams } from 'next/navigation'
import { socket } from '../../socket'
let localStream: MediaStream, remoteStream: MediaStream

const ChatPage = () => {
  const remoteSocketId = useParams().id as string
  const [isCalling, setIsCalling] = useState(false)
  const [incommingCall, setIncommingCall] = useState(false)
  const [callAccepted, setCallAccepted] = useState(false)
  const [offer, setOffer] = useState()
  const [answer, setAnswer] = useState()
  const peerRef = useRef<WebRTCPeer>()
  const localStreamRef = useRef<HTMLVideoElement>(null)
  const remoteStreamRef = useRef<HTMLVideoElement>(null)

  const onIceCandidate = useCallback(
    async (candidate: RTCIceCandidate) => {
      if (!peerRef.current.getPeerConnection().remoteDescription) return
      await peerRef.current.addIceCandidate(candidate)
      socket.emit('ice-candidate', {
        candidate,
        socketId: remoteSocketId,
      })
    },
    [remoteSocketId]
  )

  const onTrack = useCallback((event) => {
    remoteStream = new MediaStream()
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track)
    })
    remoteStreamRef.current.srcObject = remoteStream
    console.log('got remote track')
    remoteStreamRef.current.onloadedmetadata = () => {
      remoteStreamRef.current.play()
    }
  }, [])

  const startLocalStream = async (
    constraints: MediaStreamConstraints = { audio: true, video: true },
    videoRefObject: React.MutableRefObject<HTMLVideoElement> = localStreamRef
  ) => {
    localStream = await navigator.mediaDevices.getUserMedia(constraints)
    videoRefObject.current.srcObject = localStream
    videoRefObject.current.onloadedmetadata = () => {
      videoRefObject.current.play()
    }
  }

  const updateStream = async ({
    isRemote,
    audio,
    video,
  }: {
    isRemote: boolean
    audio: string
    video: string
  }) => {
    if (isRemote) {
      remoteStream.getAudioTracks().forEach((track) => {
        track.enabled = audio === 'on'
      })
      remoteStream.getVideoTracks().forEach((track) => {
        track.enabled = video === 'off'
      })
    }
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = audio === 'on'
      })
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = video === 'on'
      })
    }
  }

  const call = async () => {
    setIsCalling(true)
    await startLocalStream()
    peerRef.current = new WebRTCPeer(onIceCandidate, onTrack)
    await peerRef.current.addStream(localStream)
    peerRef.current.createOffer().then((offer) => {
      socket.emit('offer', {
        offer,
        socketId: remoteSocketId,
      })
    })
  }

  const cancelCall = () => {
    if (peerRef.current) {
      peerRef.current.getPeerConnection().close()
    }
    if (localStreamRef.current) {
      localStreamRef.current.srcObject = null
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.srcObject = null
    }
    setIsCalling(false)
    setIncommingCall(false)
    setCallAccepted(false)
  }

  const acceptOffer = async (offer: RTCSessionDescriptionInit) => {
    await startLocalStream()
    peerRef.current = new WebRTCPeer(onIceCandidate, onTrack)
    await peerRef.current.addStream(localStream)
    const answer = await peerRef.current.acceptOffer(offer)
    socket.emit('offer_accepted', {
      socketId: remoteSocketId,
      answer,
    })
  }

  useEffect(() => {
    if (socket.connected) {
      socket.on('ice-candidate', async ({ candidate, socketId }) => {
        if (peerRef.current.getPeerConnection().remoteDescription) {
          await peerRef.current.addIceCandidate(candidate)
          console.log('ice candidate added', {
            offer,
            answer,
            pc: peerRef.current.getPeerConnection(),
          })
        }
      })
      socket.on('offer_request', ({ offer, socketId }) => {
        console.log('got offer', socketId)
        setIncommingCall(true)
        setOffer(offer)
      })
    }
    socket.on('answer', async ({ answer, socketId }) => {
      await peerRef.current.acceptAnswer(answer)
      setAnswer(answer)
      setCallAccepted(true)
    })

    return () => {
      socket.off('offer_request')
      socket.off('offer_accepted')
      socket.off('ice-candidate')
      socket.off('answer')
    }
  })

  return (
    <div className='flex justify-between items-center gap-4 flex-col'>
      <div className='flex justify-center items-center gap-5'>
        {!callAccepted && (
          <button
            onClick={call}
            disabled={isCalling || incommingCall}
            className='p-2 text-bold bg-green-600 hover:bg-green-500 rounded min-w-[100px] disabled:cursor-not-allowed disabled:opacity-50'
          >
            {isCalling ? 'Calling...' : 'Call'}
          </button>
        )}
        <button
          onClick={cancelCall}
          className='p-2 text-bold bg-red-600 hover:bg-red-500 rounded min-w-[100px]'
        >
          Cancel
        </button>
        {incommingCall && !callAccepted && (
          <button
            onClick={() => acceptOffer(offer)}
            className='p-2 text-bold bg-green-600 hover:bg-green-500 rounded min-w-[100px]'
          >
            Accept
          </button>
        )}
        <button
          className='p-2 text-bold bg-red-600 hover:bg-red-500 rounded min-w-[100px]'
          onClick={async () => {
            if (answer && peerRef.current) {
              await peerRef.current.acceptAnswer(answer)
            }
            // await call()
            // await acceptOffer(offer)
          }}
        >
          Start Remote
        </button>
      </div>
      <div className='flex w-full h-full justify-center items-center'>
        <div className='flex w-1/2 h-full flex-col gap-2 justify-center items-center'>
          <video
            id='localStream'
            ref={localStreamRef}
            autoPlay
            controls
            className='w-1/2 h-1/2'
          />
          <div className='flex gap-2 justify-around items-center'>
            <button
              onClick={() => {
                updateStream({
                  isRemote: false,
                  audio: localStream.getAudioTracks()[0].enabled ? 'off' : 'on',
                  video: localStream.getVideoTracks()[0].enabled ? 'on' : 'off',
                })
              }}
            >
              Audio: {localStream?.getAudioTracks()[0].enabled ? 'on' : 'off'}
            </button>
            <button
              onClick={() => {
                updateStream({
                  isRemote: false,
                  audio: localStream.getAudioTracks()[0].enabled ? 'on' : 'off',
                  video: localStream.getVideoTracks()[0].enabled ? 'off' : 'on',
                })
              }}
            >
              Video: {localStream?.getAudioTracks()[0].enabled ? 'on' : 'off'}
            </button>
          </div>
        </div>
        <div className='flex flex-col w-1/2 justify-center items-center'>
          <video
            id='remoteStream'
            ref={remoteStreamRef}
            autoPlay
            controls
            className='w-1/2 h-1/2'
          />
          <div className='flex gap-2 items-center justify-around'>
            <button
              onClick={() => {
                updateStream({
                  isRemote: true,
                  audio: remoteStream.getAudioTracks()[0].enabled
                    ? 'off'
                    : 'on',
                  video: remoteStream.getVideoTracks()[0].enabled
                    ? 'on'
                    : 'off',
                })
              }}
            >
              Audio: {remoteStream?.getAudioTracks()[0].enabled ? 'on' : 'off'}
            </button>
            <button
              onClick={() => {
                updateStream({
                  isRemote: true,
                  audio: remoteStream.getAudioTracks()[0].enabled
                    ? 'on'
                    : 'off',
                  video: remoteStream.getVideoTracks()[0].enabled
                    ? 'off'
                    : 'on',
                })
              }}
            >
              Video: {remoteStream?.getAudioTracks()[0].enabled ? 'on' : 'off'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatPage
