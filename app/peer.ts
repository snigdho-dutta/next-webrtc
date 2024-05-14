import { createWriteStream } from 'streamsaver'
import { downloadFile } from '../utils/helpers'

export type PeerProps = {
  on_ice: (candidate: RTCIceCandidate) => void
  on_track?: (event: RTCTrackEvent) => void
  on_data_channel?: (event: RTCDataChannelEvent) => void
  on_connection_state_change?: (event: Event) => void
}

export class WebRTCPeer {
  private pc: RTCPeerConnection
  private dataChannel?: RTCDataChannel
  private worker: Worker
  constructor({
    on_ice,
    on_data_channel,
    on_track,
    on_connection_state_change,
  }: PeerProps) {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
      ],
    }
    this.pc = new RTCPeerConnection(configuration)
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        on_ice(event.candidate)
      }
    }
    this.pc.ontrack = (event) => {
      on_track?.(event)
    }
    this.pc.onconnectionstatechange = (event) => {
      on_connection_state_change?.(event)
    }
    this.pc.ondatachannel = (event) => {
      on_data_channel?.(event)
    }
  }

  async createOffer() {
    const offer = await this.pc.createOffer()
    offer.sdp = offer.sdp!.replace('b=AS:30', 'b=AS:1638400')
    await this.pc.setLocalDescription(offer)
    return offer
  }

  async acceptOffer(offer: RTCSessionDescriptionInit) {
    await this.pc.setRemoteDescription(offer)
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    return answer
  }

  async acceptAnswer(answer: RTCSessionDescriptionInit) {
    await this.pc.setRemoteDescription(answer)
  }

  async addIceCandidate(candidate: RTCIceCandidate) {
    await this.pc.addIceCandidate(candidate)
  }

  async addStream(stream: MediaStream) {
    stream.getTracks().forEach((track) => this.pc.addTrack(track, stream))
  }

  createDataChannel(label: string) {
    console.log('creating data channel', label)
    this.dataChannel = this.pc.createDataChannel(label)
    this.dataChannel.binaryType = 'arraybuffer'
    this.dataChannel.onbufferedamountlow = null
    this.dataChannel.onopen = (e) => {
      console.log('data channel open')
    }
  }

  async sendFile(file: File) {
    // const worker = new Worker('../workers/sender.ts', {
    //   workerData: { file, dataChannel: this.dataChannel },
    // })
    // worker.on('ready', (ev) => {
    //   worker.postMessage({
    //     type: 'file',
    //     file,
    //     dataChannel: this.dataChannel,
    //   })
    // })
    // worker.on('done', (ev) => {
    //   worker.terminate()
    // })

    // return
    const META_DATA = JSON.stringify({
      name: file.name,
      size: file.size,
      type: file.type,
    })
    // const worker = new Worker(new URL('/workers/sender.ts', import.meta.url))
    // const fileBuffer = await file.arrayBuffer()
    // worker.postMessage({
    //   dataChannel: this.dataChannel!,
    //   fileBuffer,
    //   fileMeta: META_DATA,
    // })
    // worker.onmessage = (ev) => {
    //   if (ev.data === 'done') {
    //     console.log('done sending file')
    //     worker.terminate()
    //   }
    // }
    // return
    const MAX_CHUNK_SIZE = 16 * 1024
    const META_OF_FILE = 'META'
    const START_OF_FILE = 'SOF'
    const END_OF_FILE = 'EOF'
    if (!this.dataChannel) return
    this.dataChannel.send(META_OF_FILE)
    this.dataChannel.send(META_DATA)
    this.dataChannel.send(START_OF_FILE)
    // const arrayBuffer = await file.arrayBuffer()
    // for (let i = 0; i < arrayBuffer.byteLength; i += MAX_CHUNK_SIZE) {
    //   this.dataChannel.send(arrayBuffer.slice(i, i + MAX_CHUNK_SIZE))
    // }
    const BYTES_PER_CHUNK = 1200
    let fileReader = new FileReader()
    let currentChunk = 0
    function readNextChunk() {
      var start = BYTES_PER_CHUNK * currentChunk
      var end = Math.min(file.size, start + BYTES_PER_CHUNK)
      fileReader.readAsArrayBuffer(file.slice(start, end))
    }

    const send = () => {
      if (
        this.dataChannel!.bufferedAmount >
        this.dataChannel!.bufferedAmountLowThreshold
      ) {
        this.dataChannel!.onbufferedamountlow = () => {
          this.dataChannel!.onbufferedamountlow = null
          send()
        }
        return
      }
    }
    
    fileReader.onload = () => {
      send()
      const buffer = fileReader.result as ArrayBuffer
      this.dataChannel!.send(buffer)
      currentChunk++
      if (BYTES_PER_CHUNK * currentChunk < file.size) {
        readNextChunk()
      } else {
        this.dataChannel!.send(END_OF_FILE)
      }
    }
    readNextChunk()
  }

  async receiveFile(onProgress?: (progress: number) => void) {
    if (!this.dataChannel) return
    // let worker: Worker
    let isReceivingMeta = false
    let isReceivingFile = false
    let isdownloading = false
    let meta:
      | { name: string; size: number; type: string; [key: string]: any }
      | undefined = undefined
    let fileBuffer: ArrayBuffer[] = []
    let receivedFileSize = 0
    const worker = new Worker(
      new URL('../workers/receiver.ts', import.meta.url)
    )
    worker.onmessage = (ev) => {
      console.log('File Buffer Received')
      if (ev.data) {
        const a = document.createElement('a')
        a.href = ev.data
        a.download = meta!.name
        a.click()
        // downloadFile(new Blob([ev.data]), meta!.name)
        //   .then(() => {
        //     console.log('File Downloaded')
        //     worker.terminate()
        //   })
        //   .catch((e) => {
        //     console.log(e)
        //     worker.terminate()
        //   })
      }
    }

    this.dataChannel.onmessage = (ev) => {
      const { data } = ev
      if (data === 'META') {
        isReceivingMeta = true
        isReceivingFile = false
        return
      }
      if (data === 'SOF') {
        isReceivingFile = true
        receivedFileSize = 0
        return
      }
      if (data === 'EOF') {
        isReceivingFile = false
        worker.postMessage('EOF')
        return
      }
      if (isReceivingMeta) {
        meta = JSON.parse(data)
        isReceivingMeta = false
      } else if (isReceivingFile) {
        receivedFileSize += data.byteLength
        worker.postMessage(data)
        fileBuffer.push(data)
        // this.dataChannel!.send(
        //   JSON.stringify({ receivedFileSize, totalFileSize: meta!.size })
        // )
        onProgress && onProgress(receivedFileSize / meta!.size)
      }

      // if (data === 'META') {
      //   isReceivingMeta = true
      //   isReceivingFile = false
      //   receivedFileSize = 0
      //   meta = undefined
      //   console.log('Receiving File Meta')
      //   return
      // } else if (data === 'SOF') {
      //   isReceivingFile = true
      //   console.log('Receiving File Contents')
      //   return
      // } else if (data === 'EOF') {
      //   isReceivingFile = false
      //   isdownloading = true
      //   const arrayBuffer = fileBuffer.reduce((acc, arrayBuffer) => {
      //     const tmp = new Uint8Array(acc.byteLength + arrayBuffer.byteLength)
      //     tmp.set(new Uint8Array(acc), 0)
      //     tmp.set(new Uint8Array(arrayBuffer), acc.byteLength)
      //     return tmp
      //   }, new Uint8Array())

      //   const fileStream = createWriteStream(meta!.name)
      //   const writableStream = fileStream.getWriter()

      //   const readableStream = new Response(new Blob([arrayBuffer])).body
      //   const total = meta?.size || arrayBuffer.byteLength
      //   let progress = 0
      //   if (readableStream) {
      //     const reader = readableStream.getReader()
      //     const pump = () =>
      //       reader.read().then(({ value, done }) => {
      //         if (done) {
      //           writableStream.close()
      //           return
      //         }
      //         writableStream.write(value)
      //         progress += value.byteLength / total
      //         console.log({ progress })
      //         pump()
      //       })

      //     pump()
      //   }
      // }
      // if (isReceivingMeta) {
      //   meta = JSON.parse(data)
      //   isReceivingMeta = false
      // } else if (isReceivingFile) {
      //   receivedFileSize += data.byteLength
      //   fileBuffer.push(data)
      //   // this.dataChannel!.send(
      //   //   JSON.stringify({ receivedFileSize, totalFileSize: meta.size })
      //   // )
      //   onProgress && onProgress(receivedFileSize / meta!.size)
      // } else if (isdownloading) {
      //   console.log({ isdownloading })
      // }
    }
  }

  async sendData(data: string) {
    this.dataChannel?.send(data)
  }

  async close() {
    this.pc.close()
  }
  getDataChannel() {
    return this.dataChannel
  }

  setDataChannel(dataChannel: RTCDataChannel) {
    this.dataChannel = dataChannel
  }
  getPeerConnection() {
    return this.pc
  }
}
// export function sendFile(file: File, dataChannel: RTCDataChannel) {
//   const CHUNK_SIZE = 16 * 1024 // Adjust the chunk size as per your requirements
//   let sequenceNumber = 0

//   function sendNextChunk() {
//     const fileReader = new FileReader()
//     fileReader.onload = function (event) {
//       const chunk = event.target.result as ArrayBuffer
//       const chunkArrayBuffer = new Uint8Array(chunk)

//       if (dataChannel.readyState === 'open') {
//         const message = {
//           sequenceNumber: sequenceNumber,
//           data: chunkArrayBuffer,
//         }
//         dataChannel.send(JSON.stringify(message))
//         sequenceNumber++
//       }

//       if (sequenceNumber * CHUNK_SIZE < file.size) {
//         sendNextChunk()
//       } else {
//         console.log('All chunks sent successfully.')
//       }
//     }

//     const start = sequenceNumber * CHUNK_SIZE
//     const end = Math.min(start + CHUNK_SIZE, file.size)
//     const chunk = file.slice(start, end)
//     fileReader.readAsArrayBuffer(chunk)
//   }

//   sendNextChunk()
// }

// export function receiveFile(dataChannel: RTCDataChannel) {
//   const receivedChunks = {}
//   let expectedSequenceNumber = 0
//   let isReceiving = false

//   dataChannel.onmessage = function (event) {
//     const message = JSON.parse(event.data)
//     console.log(message)
//     const { sequenceNumber, data } = message

//     if (sequenceNumber === expectedSequenceNumber) {
//       receivedChunks[sequenceNumber] = data
//       expectedSequenceNumber++

//       if (!isReceiving) {
//         isReceiving = true
//         reassembleFile()
//       }
//     } else {
//       console.log('Received out-of-order chunk. Dropping it.')
//     }
//   }

//   function reassembleFile() {
//     const fileChunks = []
//     for (
//       let sequenceNumber = 0;
//       sequenceNumber < expectedSequenceNumber;
//       sequenceNumber++
//     ) {
//       const chunk = receivedChunks[sequenceNumber]
//       if (chunk) {
//         fileChunks.push(chunk)
//       } else {
//         console.log('Missing chunk. Retrying...')
//         return // Wait for the missing chunk
//       }
//     }

//     const fileBlob = new Blob(fileChunks)
//     const url = URL.createObjectURL(fileBlob)
//     const downloadLink = document.createElement('a')
//     downloadLink.href = url
//     downloadLink.download = 'received_file.ext' // Replace 'ext' with the actual file extension
//     downloadLink.click()

//     console.log('File received and saved successfully.')
//   }
// }

// ----------------------------------
// const MAXIMUM_MESSAGE_SIZE = 64 * 1024
// const END_OF_FILE_MESSAGE = 'EOF'
// export const sendFile2 = async (file: File, datachannel: RTCDataChannel) => {
//   console.log('Share file')
//   if (file) {
//     const arrayBuffer = await file.arrayBuffer()
//     console.log(arrayBuffer)
//     for (let i = 0; i < arrayBuffer.byteLength; i += MAXIMUM_MESSAGE_SIZE) {
//       datachannel.send(arrayBuffer.slice(i, i + MAXIMUM_MESSAGE_SIZE))
//     }
//     datachannel.send(END_OF_FILE_MESSAGE)
//   }
// }

// export const receiveFile2 = (channel: RTCDataChannel) => {
//   const receivedBuffers: any[] = []
//   channel.onmessage = async (event) => {
//     console.log('The Answerrer received a message' + event.data)
//     const { data } = event
//     try {
//       if (data !== END_OF_FILE_MESSAGE) {
//         receivedBuffers.push(data)
//       } else {
//         const arrayBuffer = receivedBuffers.reduce((acc, arrayBuffer) => {
//           const tmp = new Uint8Array(acc.byteLength + arrayBuffer.byteLength)
//           tmp.set(new Uint8Array(acc), 0)
//           tmp.set(new Uint8Array(arrayBuffer), acc.byteLength)
//           return tmp
//         }, new Uint8Array())
//         const blob = new Blob([arrayBuffer])
//         channel.send(JSON.stringify({ success: true, message: 'file_sent' }))
//         downloadFile(blob, channel.label)
//       }
//     } catch (err) {
//       console.log('File transfer failed')
//     }
//   }
// }
