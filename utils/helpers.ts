import { createWriteStream } from 'streamsaver'
export const uid = function () {
  return (
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  )
}

export async function sendFile(file: File, channel: RTCDataChannel) {
  const CHUNK_SIZE = 16 * 1024 // Adjust the chunk size as per your requirements
  let sentSize = 0

  const fileReader = new FileReader()
  fileReader.onload = async (event) => {
    const chunk = new Uint8Array(event.target!.result as ArrayBuffer)
    if (channel.readyState === 'open') {
      channel.send(chunk)
      sentSize += chunk.length
    }

    if (sentSize < file.size) {
      await readNextChunk()
    } else {
      channel.send('EOF')
    }
  }

  const readNextChunk = async () => {
    const start = sentSize
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)
    fileReader.readAsArrayBuffer(chunk)
  }

  await readNextChunk()
}
export function receiveFile(channel: RTCDataChannel) {
  let receivedChunks: any[] = []
  let receivedSize = 0

  channel.onmessage = (event) => {
    if (event.data !== 'EOF') {
      receivedChunks.push(event.data)
      receivedSize += event.data.byteLength
    } else {
      const fileBlob = new Blob(receivedChunks)
      downloadFile(fileBlob, 'received-file')
      console.log('File received.')
    }
  }

  channel.onclose = () => {
    console.log('DataChannel closed')
  }
}

// export const downloadFile = (blob: Blob, fileName: string) => {
//   const a = document.createElement('a')
//   const url = window.URL.createObjectURL(blob)
//   a.href = url
//   a.download = fileName
//   a.click()
//   window.URL.revokeObjectURL(url)
//   a.remove()
// }

export const downloadFile = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  return fetch(url).then((res) => {
    const fileStream = createWriteStream(fileName)
    const writer = fileStream.getWriter()
    if (!res.body) throw new Error('Blob is empty')

    if (res.body.pipeTo) {
      writer.releaseLock()
      return res.body.pipeTo(fileStream)
    }

    const reader = res.body.getReader()
    const pump = () =>
      reader
        .read()
        .then(({ value, done }) =>
          done ? writer.close() : writer.write(value).then(pump)
        )

    return pump()
  })
}
