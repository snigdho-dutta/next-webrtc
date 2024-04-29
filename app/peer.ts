export class WebRTCPeer {
  private pc: RTCPeerConnection
  private dataChannel?: RTCDataChannel
  constructor(
    on_ice: (candidate: RTCIceCandidate) => void,
    on_track: (event: RTCTrackEvent) => void
  ) {
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
      on_track(event)
    }
    this.pc.onconnectionstatechange = (event) => {
      console.log(this.pc.connectionState)
    }
  }

  async createOffer() {
    const offer = await this.pc.createOffer()
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
    const META_DATA = JSON.stringify({
      name: file.name,
      size: file.size,
      type: file.type,
    })
    const MAX_CHUNK_SIZE = 16 * 1024
    const META_OF_FILE = 'META'
    const START_OF_FILE = 'SOF'
    const END_OF_FILE = 'EOF'
    if (!this.dataChannel) return
    this.dataChannel.send(META_OF_FILE)
    this.dataChannel.send(META_DATA)
    this.dataChannel.send(START_OF_FILE)
    const arrayBuffer = await file.arrayBuffer()
    for (let i = 0; i < arrayBuffer.byteLength; i += MAX_CHUNK_SIZE) {
      this.dataChannel.send(arrayBuffer.slice(i, i + MAX_CHUNK_SIZE))
    }
    this.dataChannel.send(END_OF_FILE)
  }

  async receiveFile(onProgress?: (progress: number) => void) {
    if (!this.dataChannel) return
    let isReceivingMeta = false
    let isReceivingFile = false
    let meta: { name: string; size: number; type: string; [key: string]: any }
    let receivedFileSize = 0
    const fileBuffer = []
    this.dataChannel.onmessage = (ev) => {
      const { data } = ev
      if (isReceivingMeta) {
        meta = JSON.parse(data)
        isReceivingMeta = false
      } else if (isReceivingFile) {
        if (data !== 'EOF') {
          receivedFileSize += data.byteLength
          fileBuffer.push(data)
          this.dataChannel.send(
            JSON.stringify({ receivedFileSize, totalFileSize: meta.size })
          )
          onProgress && onProgress(receivedFileSize / meta.size)
        }
      }

      switch (data) {
        case 'META':
          isReceivingMeta = true
          console.log('Receiving File Meta')
          break
        case 'SOF':
          isReceivingFile = true
          console.log('Receiving File Contents')
          break
        case 'EOF':
          isReceivingFile = false
          const arrayBuffer = fileBuffer.reduce((acc, arrayBuffer) => {
            const tmp = new Uint8Array(acc.byteLength + arrayBuffer.byteLength)
            tmp.set(new Uint8Array(acc), 0)
            tmp.set(new Uint8Array(arrayBuffer), acc.byteLength)
            return tmp
          }, new Uint8Array())
          const blob = new Blob([arrayBuffer])
          // const file = new File.(blob, meta.name, {
          //   type: meta.type,
          // })
          downloadFile(blob, meta.name)
          break
      }
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
export function sendFile(file: File, dataChannel: RTCDataChannel) {
  const CHUNK_SIZE = 16 * 1024 // Adjust the chunk size as per your requirements
  let sequenceNumber = 0

  function sendNextChunk() {
    const fileReader = new FileReader()
    fileReader.onload = function (event) {
      const chunk = event.target.result as ArrayBuffer
      const chunkArrayBuffer = new Uint8Array(chunk)

      if (dataChannel.readyState === 'open') {
        const message = {
          sequenceNumber: sequenceNumber,
          data: chunkArrayBuffer,
        }
        dataChannel.send(JSON.stringify(message))
        sequenceNumber++
      }

      if (sequenceNumber * CHUNK_SIZE < file.size) {
        sendNextChunk()
      } else {
        console.log('All chunks sent successfully.')
      }
    }

    const start = sequenceNumber * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)
    fileReader.readAsArrayBuffer(chunk)
  }

  sendNextChunk()
}

export function receiveFile(dataChannel: RTCDataChannel) {
  const receivedChunks = {}
  let expectedSequenceNumber = 0
  let isReceiving = false

  dataChannel.onmessage = function (event) {
    const message = JSON.parse(event.data)
    console.log(message)
    const { sequenceNumber, data } = message

    if (sequenceNumber === expectedSequenceNumber) {
      receivedChunks[sequenceNumber] = data
      expectedSequenceNumber++

      if (!isReceiving) {
        isReceiving = true
        reassembleFile()
      }
    } else {
      console.log('Received out-of-order chunk. Dropping it.')
    }
  }

  function reassembleFile() {
    const fileChunks = []
    for (
      let sequenceNumber = 0;
      sequenceNumber < expectedSequenceNumber;
      sequenceNumber++
    ) {
      const chunk = receivedChunks[sequenceNumber]
      if (chunk) {
        fileChunks.push(chunk)
      } else {
        console.log('Missing chunk. Retrying...')
        return // Wait for the missing chunk
      }
    }

    const fileBlob = new Blob(fileChunks)
    const url = URL.createObjectURL(fileBlob)
    const downloadLink = document.createElement('a')
    downloadLink.href = url
    downloadLink.download = 'received_file.ext' // Replace 'ext' with the actual file extension
    downloadLink.click()

    console.log('File received and saved successfully.')
  }
}

// ----------------------------------
const MAXIMUM_MESSAGE_SIZE = 64 * 1024
const END_OF_FILE_MESSAGE = 'EOF'
export const sendFile2 = async (file: File, datachannel: RTCDataChannel) => {
  console.log('Share file')
  if (file) {
    const arrayBuffer = await file.arrayBuffer()
    console.log(arrayBuffer)
    for (let i = 0; i < arrayBuffer.byteLength; i += MAXIMUM_MESSAGE_SIZE) {
      datachannel.send(arrayBuffer.slice(i, i + MAXIMUM_MESSAGE_SIZE))
    }
    datachannel.send(END_OF_FILE_MESSAGE)
  }
}

export const receiveFile2 = (channel: RTCDataChannel) => {
  const receivedBuffers = []
  channel.onmessage = async (event) => {
    console.log('The Answerrer received a message' + event.data)
    const { data } = event
    try {
      if (data !== END_OF_FILE_MESSAGE) {
        receivedBuffers.push(data)
      } else {
        const arrayBuffer = receivedBuffers.reduce((acc, arrayBuffer) => {
          const tmp = new Uint8Array(acc.byteLength + arrayBuffer.byteLength)
          tmp.set(new Uint8Array(acc), 0)
          tmp.set(new Uint8Array(arrayBuffer), acc.byteLength)
          return tmp
        }, new Uint8Array())
        const blob = new Blob([arrayBuffer])
        channel.send(JSON.stringify({ success: true, message: 'file_sent' }))
        downloadFile(blob, channel.label)
      }
    } catch (err) {
      console.log('File transfer failed')
    }
  }
}

const downloadFile = (blob, fileName) => {
  const a = document.createElement('a')
  const url = window.URL.createObjectURL(blob)
  a.href = url
  a.download = fileName
  a.click()
  window.URL.revokeObjectURL(url)
  a.remove()
}
